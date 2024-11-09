import type { NextApiRequest, NextApiResponse } from 'next'
import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk'

const explicitRelayUrls = [
  'wss://purplepag.es',
  'wss://profiles.nostr1.com',
  'wss://relay.damus.io'
]
const ndk = new NDK({explicitRelayUrls})

const pubkey = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f'

type ResponseData = {
  success: boolean
  message: string
  data?: object
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    await ndk.connect()
    const filter:NDKFilter = { kinds: [3, 10000], authors: [pubkey], limit: 10 }
    const sub1 = ndk.subscribe(filter)
    const receivedEvents:string[] = []
    sub1.on('event', async (event:NDKEvent) => {
      console.log(`event.id: ${event.id}`)
      receivedEvents.push(event.id)
    })
    sub1.on('eose', async () => {
      const response = {
        success: true,
        message: `api/tests/nostr eose!`,
        data: receivedEvents
      }
      res.status(500).json(response)
    })
  } catch (e) {
    const response = {
      success: false,
      message: `api/tests/nostr error: ${e}`
    }
    res.status(500).json(response)
  }
}
