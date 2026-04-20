import { Controller, Post, Delete, Get, Body, Query } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenerateUploadUrlDto } from './dto/s3.dto';

@Controller('s3bucket')
@ApiTags('s3bucket')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post('generate-upload-url')
  @ApiOperation({ summary: 'Generate S3 Signed Upload URL' })
  @ApiResponse({
    status: 200,
    description: 'Signed URL generated successfully.',
  })
  async getUploadURL(@Body() body: GenerateUploadUrlDto) {
    const url = await this.s3Service.generateUploadURL(
      body.fileName,
      body.fileType,
    );
    return { uploadURL: url };
  }

  @Get('signed-read-url')
  @ApiOperation({ summary: 'Generate a signed read URL for an S3 object' })
  @ApiResponse({ status: 200, description: 'Signed read URL generated.' })
  async getSignedReadURL(
    @Query('fileUrl') fileUrl: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const ttl = expiresIn ? parseInt(expiresIn, 10) : 3600;
    const signedUrl = await this.s3Service.generateSignedReadURL(fileUrl, ttl);
    return { signedUrl };
  }

  @Delete('delete')
  @ApiOperation({ summary: 'Delete File from S3 Bucket' })
  @ApiResponse({ status: 200, description: 'File deleted successfully.' })
  async deleteFile(@Query('fileName') fileName: string) {
    await this.s3Service.deleteFile(fileName);
    return { message: 'File deleted successfully' };
  }
}
