import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../src/config/index.js';

async function testR2Connection() {
  console.log('====================================================');
  console.log('🚀 CRM-LEAD: Cloudflare R2 / S3 Connection Tester');
  console.log('====================================================');
  console.log(`• Storage Driver   : ${config.storageDriver}`);
  console.log(`• Endpoint         : ${config.s3Endpoint || '(Not configured)'}`);
  console.log(`• Bucket Name      : ${config.s3Bucket}`);
  console.log(`• Region           : ${config.s3Region}`);
  console.log(`• Access Key ID    : ${config.s3AccessKeyId ? config.s3AccessKeyId.substring(0, 6) + '...' + config.s3AccessKeyId.slice(-4) : '(Missing)'}`);
  console.log(`• Secret Access Key: ${config.s3SecretAccessKey ? '********' : '(Missing)'}`);
  console.log('----------------------------------------------------');

  if (config.storageDriver === 'local') {
    console.log('ℹ️  STORAGE_DRIVER is currently set to "local".');
    console.log('   Audio files are currently being saved to your local disk.');
    console.log('\nTo switch to Cloudflare R2, update your server/.env:');
    console.log('----------------------------------------------------');
    console.log('STORAGE_DRIVER=r2');
    console.log('S3_ENDPOINT=https://<YOUR_CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com');
    console.log('S3_REGION=auto');
    console.log('S3_ACCESS_KEY_ID=your_access_key_id');
    console.log('S3_SECRET_ACCESS_KEY=your_secret_access_key');
    console.log('S3_BUCKET=crm-recordings');
    console.log('----------------------------------------------------');
    return;
  }

  if (!config.s3Endpoint || !config.s3AccessKeyId || !config.s3SecretAccessKey) {
    console.error('❌ ERROR: Missing required Cloudflare R2 credentials in .env!');
    console.error('Please ensure S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are set.');
    process.exit(1);
  }

  const endpoint = config.s3Endpoint.startsWith('http://') || config.s3Endpoint.startsWith('https://')
    ? config.s3Endpoint
    : `https://${config.s3Endpoint}`;

  const client = new S3Client({
    region: config.s3Region || 'auto',
    endpoint,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
    },
  });

  const testKey = `recordings/test/test-connection-${Date.now()}.txt`;
  const testPayload = Buffer.from('CRM-LEAD Cloudflare R2 connection test passed successfully!');

  try {
    console.log('\n⏳ Step 1: Testing Bucket access & Uploading test object...');
    await client.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: testKey,
        Body: testPayload,
        ContentType: 'text/plain',
      })
    );
    console.log(`   ✅ Successfully uploaded test object to: ${testKey}`);

    console.log('\n⏳ Step 2: Generating secure pre-signed streaming URL...');
    const presignedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.s3Bucket,
        Key: testKey,
      }),
      { expiresIn: 3600 }
    );
    console.log(`   ✅ Pre-signed streaming URL generated successfully!`);
    console.log(`   🔗 Sample URL (valid 1 hr): ${presignedUrl.substring(0, 80)}...`);

    console.log('\n⏳ Step 3: Cleaning up test object from bucket...');
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.s3Bucket,
        Key: testKey,
      })
    );
    console.log(`   ✅ Test object cleaned up successfully.`);

    console.log('\n====================================================');
    console.log('🎉 SUCCESS: Cloudflare R2 is 100% CONNECTED & WORKING!');
    console.log('Your CRM will now offload all call recordings to R2.');
    console.log('Hostinger VPS disk usage for recordings will be 0 MB.');
    console.log('====================================================');
  } catch (err: any) {
    console.error('\n❌ Cloudflare R2 Connection Failed!');
    console.error(`Details: ${err.message}`);
    if (err.name === 'NoSuchBucket') {
      console.error(`👉 The bucket "${config.s3Bucket}" does not exist in your Cloudflare R2 account. Please create it first.`);
    } else if (err.$metadata?.httpStatusCode === 403 || err.name === 'InvalidAccessKeyId') {
      console.error('👉 Authentication Failed! Please double check S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.');
    }
    process.exit(1);
  }
}

testR2Connection();
