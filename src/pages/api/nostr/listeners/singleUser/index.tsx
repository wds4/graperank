import type { NextApiRequest, NextApiResponse } from 'next'
import NDK, { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk'
import { verifyPubkeyValidity } from '@/helpers/nip19'
import { validateEvent } from 'nostr-tools'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { makeEventSerializable } from '@/helpers/indes'

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})
/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
http://localhost:3000/api/nostr/listeners/singleUser?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

https://graperank.tech/api/nostr/listeners/singleUser?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

*/

const explicitRelayUrls = [
  'wss://purplepag.es',
  'wss://profiles.nostr1.com',
  'wss://relay.damus.io'
]
const ndk = new NDK({explicitRelayUrls})

type ResponseData = {
  success: boolean
  message: string
  data?: object
}

const serializeEvent = async (event:NostrEvent) => {
  const oOutput = makeEventSerializable(event)
  const sOutput = JSON.stringify(oOutput)
  return sOutput
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (searchParams.npub) {
    // TODO: support npub
  }
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: true,
      message: `api/nostr/listeners/singleUser: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      // const currentTimestamp = Math.floor(Date.now() / 1000)
      try {
        await ndk.connect()
        const filter:NDKFilter = { kinds: [3, 10000], authors: [pubkey1], limit: 10 }
        const sub1 = ndk.subscribe(filter)
        const receivedEvents:string[] = []
        sub1.on('event', async (event:NDKEvent) => {
          if (validateEvent(event)) {
            console.log(`event.id: ${event.id}`)
            receivedEvents.push(event.id)
            /* PutObjectCommand */
            const params = {
              Bucket: 'grapevine-nostr-cache-bucket',
              Key: 'eventsByEventId/' + event.id,
              Body: await serializeEvent(event)
            }
            const command = new PutObjectCommand(params);
            const data = await client.send(command);
            console.log(`===== data: ${JSON.stringify(data)}`)
            
            if (event.kind == 3) {
            }
            if (event.kind == 10000) {
            }
          }
        })
        sub1.on('eose', async () => {
          const response = {
            success: true,
            message: `api/tests/listeners/singleUser eose!`,
            data: receivedEvents
          }
          res.status(200).json(response)
        })
      } catch (e) {
        const response = {
          success: false,
          message: `api/tests/listeners/singleUser error: ${e}`
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: true,
        message: `api/nostr/listeners/singleUser: the provided pubkey is invalid`
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: true,
      message: `api/nostr/listeners/singleUser: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}
