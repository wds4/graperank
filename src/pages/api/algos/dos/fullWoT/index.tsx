import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'

/*
calculate DoS for all pubkeys relative to the reference pubkey, provided as pubkey1
usage:
pubkey1: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
pubkey2: ad46db12ee250a108756ab4f0f3007b04d7e699f45eac3ab696077296219d207 // 2 hops away
pubkey2: 5c624c471f52d737a1e9a74f598f681d41c43703741c260aa620fcbdb8995e31 // 5 hops away
pubkey2: 1dda43d37807decafe62882615d82c22d674d5c8333a9eb314c73b6771b9224c // 9 hops away
https://www.graperank.tech/api/algos/dos/fullWoT?pubkey1=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

    MATCH p = shortestPath((:Person {name: "Alice"})-[:KNOWS*]->(:Person {name: "Bob"}))

    RETURN length(p) - 1
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
  if (!searchParams.pubkey1) {
    const response:ResponseData = {
      success: false,
      message: `api/algos/dos/fullWoT: pubkey1 was not provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey1) {
    const pubkey1 = searchParams.pubkey1
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      const cypher1 = `MATCH p = shortestPath((r:NostrUser {pubkey: '${pubkey1}'})-[:FOLLOWS*]->(n:NostrUser))
WHERE r.pubkey <> n.pubkey 
RETURN n, p, length(p) as numHops LIMIT 10`
      try {
        const result_cypher1 = await read(cypher1, {})
        console.log(result_cypher1)

        const aResults = JSON.parse(JSON.stringify(result_cypher1))
        const numHops = aResults[0].numHops.low
        
        // does not work:
        // const numHops = aResults[0].fields.numHops

        const response:ResponseData = {
          success: true,
          message: `api/algos/dos/fullWoT data:`,
          data: {
            pubkey1, numHops, cypher: cypher1, cypherQueryResult: result_cypher1
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/algos/dos/fullWoT error: ${error}`,
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
        message: `api/algos/dos/fullWoT: one or both of the provided pubkeys is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/algos/dos/fullWoT: pubkey1 was not provided`
    }
    res.status(500).json(response)
  }
}