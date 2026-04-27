import { Injectable, Logger } from '@nestjs/common';

/**
 * Resolves an Indian PIN code to approximate latitude/longitude using a free
 * public dataset (api.postalpincode.in). The values are coarse — they point
 * to the head post-office of the PIN — but that is exactly what we need to
 * pick the nearest fulfilment branch when the shopper has not granted
 * browser geolocation permission.
 *
 * Results are cached in-process for the lifetime of the Node process so we
 * do not hit the upstream API on every order. A negative cache (null entry)
 * is also kept so repeated unresolvable PINs do not retry forever.
 */
@Injectable()
export class PincodeGeoService {
  private readonly logger = new Logger(PincodeGeoService.name);
  private readonly cache = new Map<
    string,
    { lat: number; lng: number } | null
  >();
  private readonly inflight = new Map<
    string,
    Promise<{ lat: number; lng: number } | null>
  >();

  /** State / large-region centroids — used as a final fallback when the
   * upstream PIN service is unreachable so we still avoid the alphabetical
   * "default branch" landing for India-wide PINs. The first digit of an
   * Indian PIN identifies the postal region, which is enough for picking
   * a sensible nearest branch out of a small handful of candidates. */
  private static readonly REGION_FALLBACK: Record<
    string,
    { lat: number; lng: number }
  > = {
    '1': { lat: 28.6139, lng: 77.209 }, // Delhi / Northern (Delhi, HP, J&K, Punjab, Haryana)
    '2': { lat: 26.8467, lng: 80.9462 }, // UP / Uttarakhand (Lucknow)
    '3': { lat: 23.0225, lng: 72.5714 }, // Rajasthan / Gujarat (Ahmedabad)
    '4': { lat: 19.076, lng: 72.8777 }, // Maharashtra / MP / Goa / CG (Mumbai)
    '5': { lat: 17.385, lng: 78.4867 }, // Karnataka / AP / Telangana (Hyderabad)
    '6': { lat: 13.0827, lng: 80.2707 }, // Kerala / TN / Pondy (Chennai)
    '7': { lat: 22.5726, lng: 88.3639 }, // WB / Odisha / NE (Kolkata)
    '8': { lat: 25.5941, lng: 85.1376 }, // Bihar / Jharkhand (Patna)
  };

  /**
   * Resolve a 6-digit Indian PIN to lat/lng. Returns `null` when the
   * upstream service cannot identify the PIN.
   */
  async resolve(pinCode: string): Promise<{ lat: number; lng: number } | null> {
    const normalized = (pinCode || '').replace(/\s+/g, '').trim();
    if (!/^\d{6}$/.test(normalized)) return null;

    if (this.cache.has(normalized)) {
      return this.cache.get(normalized) ?? null;
    }
    const existing = this.inflight.get(normalized);
    if (existing) return existing;

    const promise = this.doResolve(normalized).then((result) => {
      this.cache.set(normalized, result);
      this.inflight.delete(normalized);
      return result;
    });
    this.inflight.set(normalized, promise);
    return promise;
  }

  private async doResolve(
    pin: string,
  ): Promise<{ lat: number; lng: number } | null> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(
        `https://api.postalpincode.in/pincode/${pin}`,
        { signal: ctrl.signal, headers: { Accept: 'application/json' } },
      ).finally(() => clearTimeout(timer));
      if (!res.ok) {
        return this.regionFallback(pin);
      }
      const json = (await res.json()) as Array<{
        Status?: string;
        PostOffice?: Array<{
          Latitude?: string | number | null;
          Longitude?: string | number | null;
          District?: string | null;
          State?: string | null;
        }>;
      }>;
      const offices = json?.[0]?.PostOffice ?? [];
      // Some entries have empty / "NA" coordinates. Pick the first usable
      // pair, otherwise fall back to the regional centroid so callers
      // still get something workable.
      for (const po of offices) {
        const lat = Number(po?.Latitude);
        const lng = Number(po?.Longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
          return { lat, lng };
        }
      }
      return this.regionFallback(pin);
    } catch (err) {
      // Network errors should not fail order placement — degrade to the
      // regional centroid so the routing still gets useful coordinates.
      this.logger.warn(
        `PIN geocode failed for ${pin}: ${
          err instanceof Error ? err.message : String(err)
        } — using regional fallback`,
      );
      return this.regionFallback(pin);
    }
  }

  private regionFallback(
    pin: string,
  ): { lat: number; lng: number } | null {
    const region = pin.charAt(0);
    return PincodeGeoService.REGION_FALLBACK[region] ?? null;
  }
}
