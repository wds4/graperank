import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'

/*
Given an observer and observee, this endpoint returns:
- cypher0: the DoS from the observer to the observee

usage:
observer: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
observee: d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d // 3 hops away
observee: c06885ce21d132b3c29e74aea9f4c171a95b2ed56bafac58a5fbfc9bdc5fbb06 // 3 hops away
observee: 1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b // 2 hops away
observee: cbaa0c829ed322c1551cb6619b4c08b9a26ac97ffb4e959205eec78ee9313245 // 1 hop away

WORKING
https://www.graperank.tech/api/outwardFacing/getDos?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d

WORKING
https://www.graperank.tech/api/outwardFacing/getDos?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=c06885ce21d132b3c29e74aea9f4c171a95b2ed56bafac58a5fbfc9bdc5fbb06

WORKING
https://www.graperank.tech/api/outwardFacing/getDos?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b

WORKING
https://www.graperank.tech/api/outwardFacing/getDos?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=cbaa0c829ed322c1551cb6619b4c08b9a26ac97ffb4e959205eec78ee9313245

WORKING:
https://www.graperank.tech/api/outwardFacing/getDos?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245

*/
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (searchParams.npub) {
    // TODO: support npub
  }
  if (!searchParams.observer) {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getDos: no observer was provided`
    }
    res.status(500).json(response)
  }
  if (!searchParams.observee) {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getDos: no observee was provided`
    }
    res.status(500).json(response)
  }
  const observer = searchParams.observer
  const observee = searchParams.observee  
  if (typeof observer == 'string' && verifyPubkeyValidity(observer) && typeof observee == 'string' && verifyPubkeyValidity(observee)) {
    const cypher0 = `MATCH p = SHORTEST 1 (n:NostrUser)-[:FOLLOWS]->+(m:NostrUser)
    WHERE n.pubkey='${observer}' AND m.pubkey='${observee}'
    RETURN length(p) as dos` 

    try {

      const result_cypher0 = await read(cypher0, {})
      const aResults = JSON.parse(JSON.stringify(result_cypher0))
      const dos = aResults[0].dos.low

      const response:ResponseData = {
        success: true,
        exists: true,
        message: `api/outwardFacing/getDos data:`,
        data: {
          observer, observee, dos, 
        }
      }
      res.status(200).json(response)
    } catch (error) {
      const response = {
        success: false,
        message: `api/outwardFacing/getDos error: ${error}`,
        data: {
          observer,
          cypher0,
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getDos: the provided observer and / or observee pubkey is invalid`,
      data: {
        observer, observee
      }
    }
    res.status(500).json(response)
  }
}