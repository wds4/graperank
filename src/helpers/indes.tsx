import { NostrEvent } from "@nostr-dev-kit/ndk"

export const makeEventSerializable = (oEventIn:NostrEvent) => {
    const oEventOut:NostrEvent = {
        id: oEventIn.id,
        kind: oEventIn.kind,
        content: oEventIn.content,
        tags: oEventIn.tags,
        created_at: oEventIn.created_at,
        pubkey: oEventIn.pubkey,
        sig: oEventIn.sig,
    }
    return oEventOut
  }