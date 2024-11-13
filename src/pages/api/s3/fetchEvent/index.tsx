import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'

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
  if (!searchParams.eventid) {
    const response:ResponseData = {
      success: false,
      message: `api/s3/fetchEvent: no eventid was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.eventid) {
    const eventId = searchParams.eventid
    if (typeof eventId == 'string') {
      try {
        const params = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: eventId,
        }
        const command = new GetObjectCommand(params);
        const data = await client.send(command);
        const sEvent = await data.Body?.transformToString()

        let oEvent = ''
        if (typeof sEvent == 'string') {
          oEvent = JSON.parse(sEvent) 
        }

        const isEventValid = validateEvent(oEvent)

        const response:ResponseData = {
          success: true,
          message: `api/s3/fetchEvent data:`,
          data: { 
            isEventValid,
            event: oEvent
          }
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
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/s3/fetchEvent error: the provided eventid is not valid`,
      }
      res.status(500).json(response)
    }
  }
}