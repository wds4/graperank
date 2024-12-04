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

export const timeout = (ms:number) => new Promise((resolve) => setTimeout(resolve, ms));

type Foo = {[key: string | number]: string | number | object }[]
export const arrayToObject = (array:Foo, keyField:string) => 
    Object.fromEntries(array.map(item => [item[keyField], item]));
