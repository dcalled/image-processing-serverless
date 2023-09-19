import { S3Event, SQSEvent } from 'aws-lambda';
import { fetchObject, makeThumbnail, uploadObject } from './ImageProcessor';

export const processImage =  async (event: SQSEvent) => {
  console.log('Image processing started... Event: ', event, 
    `Bucket photos: ${process.env.PHOTOS_BUCKET_NAME}. Bucket thumbs: ${process.env.THUMBNAILS_BUCKET_NAME}`);
  for(const sqsRecord of event.Records) {
    if(!sqsRecord.body.startsWith('{\"Records\":') 
      || sqsRecord.body.includes('s3:TestEvent')) continue;
    for(const s3Record of (JSON.parse(sqsRecord.body) as S3Event).Records) {
      const { key } = s3Record.s3.object;
      console.log('Processing ', key);

      const originalObject = await fetchObject(key, process.env.PHOTOS_BUCKET_NAME);
      console.log('Object fetched');

      const originalImg = originalObject.Body as Buffer;
      console.log('original: ', originalImg.byteLength, ' bytes');

      const thumbnail = await makeThumbnail(originalImg, 0.15);
      
      console.log('thumbnail: ', thumbnail.byteLength, ' bytes');
      await uploadObject(key, process.env.THUMBNAILS_BUCKET_NAME, thumbnail);
    }
  }
}