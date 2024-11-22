import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import NDK, { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk'
import { validateEvent } from 'nostr-tools'
import { makeEventSerializable } from '@/helpers'

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

const serializeEvent = async (event:NostrEvent) => {
  const oOutput = makeEventSerializable(event)
  const sOutput = JSON.stringify(oOutput)
  return sOutput
}

const explicitRelayUrls = [
  'wss://purplepag.es',
  'wss://profiles.nostr1.com',
  'wss://relay.damus.io'
]
const ndk = new NDK({explicitRelayUrls})

const fooFxn = async () => {
  console.log(`try`)
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const sinceTimestamp = currentTimestamp - 3600
  await ndk.connect()
  const filter:NDKFilter = { kinds: [3, 10000], since: sinceTimestamp, limit: 10 }
  const sub1 = ndk.subscribe(filter)
  sub1.on('event', async (event:NDKEvent) => {
    if (validateEvent(event)) {
      console.log(`received event.kind: ${event.kind}; event.id: ${event.id}`)
      /* PutObjectCommand */
      const params = {
        Bucket: 'grapevine-nostr-cache-bucket',
        Key: 'recentlyAddedEventsByEventId/' + event.id,
        Body: await serializeEvent(event),
      }
      const command_s3 = new PutObjectCommand(params);
      const data = await client.send(command_s3);
      console.log(`===== data: ${JSON.stringify(data)}`)
    }
  })
}

export default function Page() {
  fooFxn()
  return (
    <div>
      <center><h1>The GrapeRank nostr background listener</h1></center>
      <center><h3>maintains subscriptions to relays for live updates of kinds 3 and 10000 notes</h3></center>
    </div>
  )
}