import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'

/*
usage:
pubkey1: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
pubkey2: ad46db12ee250a108756ab4f0f3007b04d7e699f45eac3ab696077296219d207
pubkey2: 5c624c471f52d737a1e9a74f598f681d41c43703741c260aa620fcbdb8995e31 // 5 hops away
https://www.graperank.tech/api/neo4j/getShortestPath?pubkey1=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&pubkey2=5c624c471f52d737a1e9a74f598f681d41c43703741c260aa620fcbdb8995e31

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
  if ((!searchParams.pubkey1) || (!searchParams.pubkey2)) {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getShortestPath: pubkey1 and/or pubkey2 were not provided`
    }
    res.status(500).json(response)
  }
  if ((searchParams.pubkey1) && (searchParams.pubkey2)) {
    const pubkey1 = searchParams.pubkey1
    const pubkey2 = searchParams.pubkey2
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1) && typeof pubkey2 == 'string' && verifyPubkeyValidity(pubkey2)) {
      const cypher1 = `MATCH p = SHORTEST 1 (n:NostrUser)-[:FOLLOWS]->+(m:NostrUser)
WHERE n.pubkey='${pubkey1}' AND m.pubkey='${pubkey2}'
RETURN length(p) as numHops` 
      try {
        const result_cypher1 = await read(cypher1, {})
        console.log(result_cypher1)

        const aResults = JSON.parse(JSON.stringify(result_cypher1))
        const numHops = aResults[0].numHops.low
        
        // does not work:
        // const numHops = aResults[0].fields.numHops

        const response:ResponseData = {
          success: true,
          message: `api/neo4j/getShortestPath data:`,
          data: {
            pubkey1, pubkey2, numHops, cypher: cypher1
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/neo4j/getShortestPath error: ${error}`,
          data: {
            pubkey1,
            cypher1
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/neo4j/getShortestPath: one or both of the provided pubkeys is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getShortestPath: pubkey1 and/or pubkey2 were not provided`
    }
    res.status(500).json(response)
  }
}