// eslint-disable-next-line @typescript-eslint/no-require-imports
// const NDK = require('@nostr-dev-kit/ndk').NDK
import NDK from '@nostr-dev-kit/ndk'

console.log('Node.js script executed!');

const explicitRelayUrls = [
  'wss://purplepag.es',
  'wss://profiles.nostr1.com',
  'wss://relay.damus.io'
]
const ndk = new NDK({explicitRelayUrls})

const pubkey = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f'

try {
    ndk.connect()
    const filter = { kinds: [3, 10000], authors: [pubkey], limit: 10 }
    const sub1 = ndk.subscribe(filter)
    const receivedEvents = []
    sub1.on('event', async (event) => {
      console.log(`event.id: ${event.id}`)
      receivedEvents.push(event.id)
    })
    sub1.on('eose', async () => {
      const response = {
        success: true,
        message: `api/tests/nostr eose!`,
        data: receivedEvents
      }
      res.status(200).json(response)
    })
  } catch (e) {
    const response = {
      success: false,
      message: `api/tests/nostr error: ${e}`
    }
    res.status(500).json(response)
  }
