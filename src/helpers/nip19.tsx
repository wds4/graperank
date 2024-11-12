import { nip19 } from 'nostr-tools'

export function verifyPubkeyValidity(str:string) {
    try {
        const npub = nip19.npubEncode(str)
        if (npub) {
            return true
        }
        return false
    } catch (e) {
        console.log(e)
        return false
    }
}

export function npubEncode(pubkey:string) {
    try {
        const npub = nip19.npubEncode(pubkey)
        if (npub) {
            return npub
        }
        return 'could not calculate npub'
    } catch (e) {
        console.log(e)
        return 'could not calculate npub'
    }
}
