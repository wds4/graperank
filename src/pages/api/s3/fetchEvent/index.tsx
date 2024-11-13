import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    /* GetObjectCommand */
    
    const params = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: 'c346a79311bbf7d574024854fcc41884441a023d5c685cd0d317b9bd1e66f30f',
    }
    const command = new GetObjectCommand(params);
    const data = await client.send(command);
    const foo = await data.Body?.transformToString()

    let data_ = ''
    if (typeof foo == 'string') {
      data_ = JSON.parse(foo) 
    }

    console.log(`=============== data Body transformToString: ${foo}`)

    const response:ResponseData = {
      success: true,
      message: `api/s3/fetchEvent data!`,
      data: { data: data_ }
    }
    res.status(200).json(response)
  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/s3/fetchEvent error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}