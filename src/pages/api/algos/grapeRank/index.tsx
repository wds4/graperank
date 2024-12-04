import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { write } from '@/lib/neo4j'

/*
Calculate PageRank scores for all pubkeys 

NOT YET COMPLETED

usage:
e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/grapeRank?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
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
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/algos/pageRank: pubkey was not provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      const cypher1 = ``
      try {
        const result_cypher1 = await write(cypher1, {})
        console.log(result_cypher1)

        const aResults = JSON.parse(JSON.stringify(result_cypher1))

        const aDoSWoT:string[][] = []
        aDoSWoT[0] = []
        aDoSWoT[0].push(pubkey1)
        let maxNumHops = 0
        for (let x=0; x < aResults.length; x++) {
          const numHops = aResults[x].numHops.low
          if (!aDoSWoT[numHops]) {
            aDoSWoT[numHops] = []
          }
          const pk = aResults[x].n.properties.pubkey
          aDoSWoT[numHops].push(pk)
          maxNumHops = Math.max(maxNumHops, numHops)
        }

        type oCnt = {[key:string]: number}
        const oCounts:oCnt = {}
        let numPubkeysTotal = 0
        for (let x=0; x <= maxNumHops; x++) {
          const foo = 'numHops_' + x.toString()
          oCounts[foo] = aDoSWoT[x].length
          numPubkeysTotal += aDoSWoT[x].length
        }

        const response:ResponseData = {
          success: true,
          message: `api/algos/pageRank data:`,
          data: {
            referencePubkey: pubkey1, 
            cypher: cypher1,
            maxNumHops,
            numPubkeysTotal,
            numPubkeysByDoS: oCounts,
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/algos/pageRank error: ${error}`,
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
        message: `api/algos/pageRank: one or both of the provided pubkeys is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/algos/pageRank: pubkey was not provided`
    }
    res.status(500).json(response)
  }
}