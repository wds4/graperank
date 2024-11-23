import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'
import { NostrEvent } from "@nostr-dev-kit/ndk"
import { isValidPubkey } from '@/helpers/nip19'

/*
to access:
https://graperank.tech/api/neo4j/generateCsv/fromSingleKind3EventId?kind3EventId=e4886fb39d2ce9014e674b8db78810e5580935253b53d67fc81945f0e8544816
*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

const testCsv2 = `1,c49d52a573366792b9a6e4851587c28042fb24fa5625c6d67b8c95c8751aca15,e5db8b6f4825192bf1e71239b61a7dacc934797d227c2bd373997a16cd293406
2,c49d52a573366792b9a6e4851587c28042fb24fa5625c6d67b8c95c8751aca15,175298f424163ac83127cc91a3bd8d173ece6c53ed14a14327c018eac86e79f8
3,c49d52a573366792b9a6e4851587c28042fb24fa5625c6d67b8c95c8751aca15,d75a0bcc4b494628d51ceab95ca1b34b9b23b1cb3a715beb1c5a8d963d161460`


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let kind3EventId = 'e4886fb39d2ce9014e674b8db78810e5580935253b53d67fc81945f0e8544816'

  const searchParams = req.query
  if (searchParams.kind3EventId && typeof searchParams.kind3EventId == 'string') {
    kind3EventId = searchParams.kind3EventId
  }
  console.log(`numUsersToProcess: ${kind3EventId}`)

  if (kind3EventId) {
    const params_get = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: 'eventsByEventId/' + kind3EventId,
    }
    const command_s3_get = new GetObjectCommand(params_get);
    const data_get = await client.send(command_s3_get);
    console.log(data_get)
    const sEvent = await data_get.Body?.transformToString()
    if (typeof sEvent == 'string') {
      const oKind3Event:NostrEvent = JSON.parse(sEvent) 
      const isEventValid = validateEvent(oKind3Event)
      if (isEventValid) {
        const pubkey_parent = oKind3Event.pubkey
        try {
          // TODO: build csv from oKind3Event
          const aPubkeysDiscovered = []
          const aTags = oKind3Event.tags
          let csvOutput = ''
          let n=1
          for (let t=0; t < aTags.length; t++) {
            const aTag = aTags[t]
            if (aTag && aTag[0] == 'p' && aTag[1] && isValidPubkey(aTag[1])) {
              const pubkey_child = aTag[1]
              csvOutput += `${n},${pubkey_parent},${pubkey_child}\n`
              aPubkeysDiscovered.push(pubkey_child)
              n++
            }
          }
          res.status(200).send(csvOutput)
        } catch (error) {
          const response = {
            success: false,
            message: `api/neo4j/generateCsv/fromSingleKind3EventId error: ${error}`,
          }
          res.status(500).json(response)
        }
      }
    }
  }
}