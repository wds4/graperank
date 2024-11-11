import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand, PutObjectCommand, ListBucketsCommand, ListObjectsCommand } from '@aws-sdk/client-s3'

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})
const params1 = {
  /** input parameters */
};
const params2 = {
  Bucket: 'grapevine-nostr-cache-bucket'
};

const command1 = new ListBucketsCommand(params1);
const command2 = new ListObjectsCommand(params2);

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}

const fooFxn = async () => {
  const oOutput = { foo: 'bar', a: 'b' }
  const sOutput = JSON.stringify(oOutput)
  return sOutput
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    console.log(`key: ${process.env.AWS_ACCESS_KEY_ID}`)
    const data1 = await client.send(command1);
    console.log(`= data1: ${JSON.stringify(data1)}`)
    
    const data2 = await client.send(command2);
    console.log(`= data2: ${JSON.stringify(data2)}`)

    /* PutObjectCommand */
    const params3 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: 'whatGoesHere',
      Body: await fooFxn()
    }
    const command3 = new PutObjectCommand(params3);
    const data3 = await client.send(command3);
    console.log(`= data3: ${JSON.stringify(data3)}`)

    /* GetObjectCommand */
    
    const params4 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: 'whatGoesHere',
    }
    const command4 = new GetObjectCommand(params4);
    const data4 = await client.send(command4);
    const foo = await data4.Body?.transformToString()

    let data4_ = ''
    if (typeof foo == 'string') {
      data4_ = JSON.parse(foo) 
    }

    console.log(`=============== data4 Body transformToString: ${foo}`)

    const response:ResponseData = {
      success: true,
      message: `api/tests/s3 data!`,
      data: { data1, data2, data3, data4: data4_ }
    }
    res.status(200).json(response)
  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/tests/s3 error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}