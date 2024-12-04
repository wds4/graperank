import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'

/*
usage:
observer: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
observee: d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d // 3 hops away
https://www.graperank.tech/api/neo4j/getRatorsWithDos?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d

*/

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
  if (searchParams.npub) {
    // TODO: support npub
  }
  if (!searchParams.observer) {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getRatorsWithDos: no observer was provided`
    }
    res.status(500).json(response)
  }
  if (!searchParams.observee) {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getRatorsWithDos: no observee was provided`
    }
    res.status(500).json(response)
  }
  const observer = searchParams.observer
  const observee = searchParams.observee  
  if (typeof observer == 'string' && verifyPubkeyValidity(observer) && typeof observee == 'string' && verifyPubkeyValidity(observee)) {
    const cypher0 = `MATCH p = SHORTEST 1 (n:NostrUser)-[:FOLLOWS]->+(m:NostrUser)
    WHERE n.pubkey='${observer}' AND m.pubkey='${observee}'
    RETURN p, length(p) as numHops` 

    const cypher1 = `MATCH (n:NostrUser {pubkey: '${observee}'})<-[:FOLLOWS]-(m:NostrUser) RETURN m `
    const cypher2 = `MATCH (n:NostrUser {pubkey: '${observee}'})<-[:MUTES]-(m:NostrUser) RETURN m `
    try {
      const result_cypher0 = await read(cypher0, {})

      const aResults = JSON.parse(JSON.stringify(result_cypher0))
      const numHops = aResults[0].numHops.low

      const result1 = await read(cypher1, {})
      const aFollowerPubkeys = []
      const aFollowers = JSON.parse(JSON.stringify(result1))
      for (let x=0; x < aFollowers.length; x++) {
        const oNextUserData = aFollowers[x]
        const pk = oNextUserData.m.properties.pubkey
        const oRating = {rator: pk, dos: 0, timestamp: 0}
        aFollowerPubkeys.push(oRating)
      }

      const result2 = await read(cypher2, {})
      const aMuterPubkeys = []
      const aMuters = JSON.parse(JSON.stringify(result2))
      for (let x=0; x < aMuters.length; x++) {
        const oNextUserData = aMuters[x]
        const pk = oNextUserData.m.properties.pubkey
        const oRating = {rator: pk, dos: 0, timestamp: 0}
        aMuterPubkeys.push(oRating)
      }

      const response:ResponseData = {
        success: true,
        message: `api/neo4j/getRatorsWithDos data:`,
        data: {
          ratee: observee, dos: numHops, 
          ratings: {
            3: aFollowerPubkeys,
            10000: aMuterPubkeys,
          },
          cypher0, cypher1, cypher2, numMuters: aMuterPubkeys.length, numFollowers: aFollowerPubkeys.length,
        }
      }
      res.status(200).json(response)
    } catch (error) {
      const response = {
        success: false,
        message: `api/neo4j/getRatorsWithDos error: ${error}`,
        data: {
          observer,
          cypher1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getRatorsWithDos: the provided observer and / or observee pubkey is invalid`,
      data: {
        observer, observee
      }
    }
    res.status(500).json(response)
  }
}