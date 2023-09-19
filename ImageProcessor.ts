
import { S3Event, SQSEvent } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { PutObjectOutput } from 'aws-sdk/clients/s3';
import sharp from 'sharp';

const s3 = new S3();

export async function processSqsEvent(event: SQSEvent) {
  console.log('Image processing started... Event: ', event,
    `Bucket photos: ${process.env.PHOTOS_BUCKET_NAME}. Bucket thumbs: ${process.env.THUMBNAILS_BUCKET_NAME}`);
  for (const { body } of event.Records) {
    if (!body.startsWith('{\"Records\":')
      || body.includes('s3:TestEvent')) continue;
    await processS3Event(JSON.parse(body) as S3Event);
  }
}

export async function processS3Event(event: S3Event) {
  for (const s3Record of event.Records) {
    try {
      const { key } = s3Record.s3.object;
      console.log('Processing ', key);

      const originalObject = await fetchObject(key, process.env.PHOTOS_BUCKET_NAME);
      console.log('Object fetched');

      const originalImg = originalObject.Body as Buffer;
      console.log('original: ', originalImg.byteLength, ' bytes');

      const thumbnail = await makeThumbnail(originalImg, 0.15);
      console.log('thumbnail: ', thumbnail.byteLength, ' bytes');

      await uploadObject(key, process.env.THUMBNAILS_BUCKET_NAME, thumbnail);
      console.log('Thumbnail uploaded.');
    } catch (err) {
      handleError(err.message);
    }
  }
}

export async function fetchObject(key: string, bucket: string): Promise<S3.GetObjectOutput> {
  const object = await s3.getObject({
    Bucket: bucket,
    Key: key
  }).promise();
  if (object.$response.error) {
    throw `Error fetching data from S3. Bucket: ${bucket}. Key: ${key}. Original error message: ${object.$response.error.message}`;
  }
  return object.$response.data as S3.GetObjectOutput;
}

export function makeThumbnail(originalImg: Buffer, sizePercent: number): Promise<Buffer> {
  try {
    return sharp(originalImg)
      .metadata()
      .then(({ width }) => sharp(originalImg)
        .resize(Math.round(width * sizePercent))
        .toBuffer()
      );
  } catch (err) {
    throw `Error during image processing. Original error message: ${err.message}`;
  }
}

export async function uploadObject(key: string, bucket: string, object: Buffer): Promise<PutObjectOutput> {
  const uploadRes = await s3.putObject({
    Body: object,
    Bucket: bucket,
    Key: key
  }).promise();
  if (uploadRes.$response.error) {
    throw `Error uploading data to S3. Bucket: ${bucket}. Key: ${key}. Original error message: ${uploadRes.$response.error.message}`;
  }
  return uploadRes.$response.data as PutObjectOutput;
}

function handleError(message: string) {
  console.error(message);
}