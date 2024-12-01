import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://graperank.tech/api/customers/fetchWoT/dos?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

*/

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
  const searchParams = req.query
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/customers/fetchWoT/dos: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string') {
      try {
        const params = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${pubkey1}/dos`,
        }
        const command = new GetObjectCommand(params);
        const data = await client.send(command);
        const sDos = await data.Body?.transformToString()

        let oDos = ''
        if (typeof sDos == 'string') {
          oDos = JSON.parse(sDos) 
        }

        const response:ResponseData = {
          success: true,
          message: `api/customers/fetchWoT/dos data:`,
          data: { 
            pubkey1,
            dos: oDos
          }
        }
        res.status(200).json(response)
      } catch (error) {
        // error handling.
        console.log(`error: ${JSON.stringify(error)}`)
        const response:ResponseData = {
          success: false,
          message: `api/customers/fetchWoT/dos error: ${error}!`,
        }
        res.status(500).json(response)
      } finally {
        // finally.
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/customers/fetchWoT/dos error: the provided eventid is not valid`,
      }
      res.status(500).json(response)
    }
  }
}