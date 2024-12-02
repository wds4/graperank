import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { write } from '@/lib/neo4j'

/*
calculate DoS for all pubkeys relative to the reference pubkey, provided as pubkey1

set hops property for nodes in graph (Not intended for general usage; only for internal use)

usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/personalizedPageRank/fullWoT?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

takes about 19 seconds

cypher1: project graph:
MATCH (source:NostrUser)-[r:FOLLOWS]->(target:NostrUser)
RETURN gds.graph.project(
  'personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f',
  source,
  target
)
// takes about 10 seconds

memory estimation:
CALL gds.pageRank.write.estimate('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f', {
  writeProperty: 'pageRank',
  maxIterations: 20,
  dampingFactor: 0.85
})
YIELD nodeCount, relationshipCount, bytesMin, bytesMax, requiredMemory
// about 4 MB

stream results: 
CALL gds.pageRank.stream('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).pubkey AS pubkey, score
ORDER BY score DESC, pubkey ASC
// takes about 15 seconds

write results to neo4j
CALL gds.pageRank.write('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f', {
  maxIterations: 20,
  dampingFactor: 0.85,
  writeProperty: 'pagerank'
})
YIELD nodePropertiesWritten, ranIterations

cypher2: personalized pageRank and stream results:
MATCH (refUser:NostrUser {pubkey: 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f'})
CALL gds.pageRank.stream('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f', {
  maxIterations: 20,
  dampingFactor: 0.85,
  sourceNodes: [refUser]
})
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).pubkey AS pubkey, score
ORDER BY score DESC, pubkey ASC
// about 13 sec

CALL gds.graph.list() YIELD graphName

CALL gds.graph.drop('personalizedPageRank_e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f') YIELD graphName

TODO:
drop project if already exists
OR just drop it after using it
*/

type ResponseData = {
  success: boolean,
  exists?: boolean,
  message: string,
  data?: object,
}

type PprScores = []

type PprMetaData = {
  whenLastUpdated: number,
  referencePubkey: string,
  cypher1: string,
  cypher2: string,
  cypher3: string,
}

type PprData = {
  numPubkeysTotal: number,
  scores?:PprScores, // PprScores
}

type PPR = {
  metaData: PprMetaData,
  data: PprData
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/algos/personalizedPageRank/fullWoT: pubkey was not provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      const cypher1 = `MATCH (source:NostrUser)-[r:FOLLOWS]->(target:NostrUser)
RETURN gds.graph.project(
  'personalizedPageRank_${pubkey1}',
  source,
  target
)`
      const cypher2 = `MATCH (refUser:NostrUser {pubkey: '${pubkey1}'})
CALL gds.pageRank.stream('personalizedPageRank_${pubkey1}', {
  maxIterations: 20,
  dampingFactor: 0.85,
  sourceNodes: [refUser]
})
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).pubkey AS pubkey, score
ORDER BY score DESC, pubkey ASC`

      const cypher3 = `CALL gds.graph.drop('personalizedPageRank_${pubkey1}') YIELD graphName
`
      try {
        const result_cypher1 = await write(cypher1, {})
        // console.log(result_cypher1)
        // const aResults1 = JSON.parse(JSON.stringify(result_cypher1))

        const result_cypher2 = await write(cypher2, {})
        // console.log(result_cypher2)
        const aResults2:PprScores = JSON.parse(JSON.stringify(result_cypher2))

        const result_cypher3 = await write(cypher3, {})
        // console.log(result_cypher3)
        // const aResults3 = JSON.parse(JSON.stringify(result_cypher3))

        const currentTimestamp = Math.floor(Date.now() / 1000)

        const oPersonalizedPageRank:PPR = {
          metaData: {
            whenLastUpdated: currentTimestamp,
            referencePubkey: pubkey1, 
            cypher1,
            cypher2,
            cypher3,
          },
          data: {
            numPubkeysTotal: aResults2.length,
            scores:aResults2,
          },
        }

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/algos/personalizedPageRank/fullWoT data:`,
          data: {
            result_cypher1,
            result_cypher3,
            oPersonalizedPageRank,
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/algos/personalizedPageRank/fullWoT error: ${error}`,
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
        message: `api/algos/personalizedPageRank/fullWoT: the provided pubkey is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/algos/personalizedPageRank/fullWoT: pubkey was not provided`
    }
    res.status(500).json(response)
  }
}