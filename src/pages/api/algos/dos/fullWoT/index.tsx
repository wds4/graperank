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
RETURN n, length(p) as numHops LIMIT 600`
      try {
        const result_cypher1 = await read(cypher1, {})
        console.log(result_cypher1)

        const aResults = JSON.parse(JSON.stringify(result_cypher1))

        const aDoSWoT:string[][] = []
        aDoSWoT[0] = []
        aDoSWoT[1] = []
        aDoSWoT[2] = []
        aDoSWoT[3] = []
        for (let x=0; x < aResults.length; x++) {
          const numHops = aResults[x].numHops.low
          if (!aDoSWoT[numHops]) {
            aDoSWoT[numHops] = []
          }
          const pk = aResults[x].n.properties.pubkey
          aDoSWoT[numHops].push(pk)
        }
        // does not work:
        // const numHops = aResults[0].fields.numHops

        const response:ResponseData = {
          success: true,
          message: `api/algos/dos/fullWoT data:`,
          data: {
            pubkey1, 
            cypher: cypher1,
            counts: {
              dos_0: aDoSWoT[0].length,
              dos_1: aDoSWoT[1].length,
              dos_2: aDoSWoT[2].length,
              dos_3: aDoSWoT[3].length,
            },
            aDoSWoT, 
            cypherQueryResult: result_cypher1
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