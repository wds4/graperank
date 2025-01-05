import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { PPR, PprScores, ResponseData } from '@/types'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

/*
TODO: error handling (if data not present)

Given an observer and observee, this endpoint returns the GrapeRank score of the observee, if it has been calculated for the observer.
If not, return exists: false.

usage:
observer: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
observee: d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d // 3 hops away
observee: c06885ce21d132b3c29e74aea9f4c171a95b2ed56bafac58a5fbfc9bdc5fbb06 // 3 hops away
observee: 1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b // 2 hops away
observee: cbaa0c829ed322c1551cb6619b4c08b9a26ac97ffb4e959205eec78ee9313245 // 1 hop away

PROBLEM:
observee: aa6c9c18b27d4b541c59925a680cab38fa65966760ac2d7e8eae52f44890bd5a // some sort of error; 
- no sqlid, no pagerank, in neo4j
- in sql: kind0EventId, kind3EventId, kind10000EventId are all null
- sql: whenLastListened is null 
- sql: flaggedForKind3EventProcessing =1 but https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=1 yields neo4j error: Merge did not find a matching node n and can not create a new node due to conflicts with existing unique nodes!
- graperank score 0,0,0,0 at https://www.graperank.tech/api/outwardFacing/getPageRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=aa6c9c18b27d4b541c59925a680cab38fa65966760ac2d7e8eae52f44890bd5a
- average, confidence each -1 in big table by UI, so influence incorrectly shows up as 1

PROBLEM: probably resulting from pubkey sometimes with ALL CAPS but sometimes lowercase; sql treats these as the same, but neo4j as 2 different
SOLUTION: not sure yet. Maybe need to fix the ALL CAPS problem by removing duplicates.
POSSIBLE ETIOLOGY: maybe because of out of date
- https://www.graperank.tech/api/dataManagement/users/addSqlIdsByPubkeyLookupToS3 
and 
- https://www.graperank.tech/api/dataManagement/users/addPubkeysBySqlIdLookupToS3
POSSIBLE SOLUTIONS: 
1. update those more often. (whenever scores are calculated??)
OR
2. eliminate dependency on those files; create them on the fly when they are needed.

https://www.graperank.tech/api/outwardFacing/getPageRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d

https://www.graperank.tech/api/outwardFacing/getPageRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=c06885ce21d132b3c29e74aea9f4c171a95b2ed56bafac58a5fbfc9bdc5fbb06

https://www.graperank.tech/api/outwardFacing/getPageRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b

https://www.graperank.tech/api/outwardFacing/getPageRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=cbaa0c829ed322c1551cb6619b4c08b9a26ac97ffb4e959205eec78ee9313245

https://www.graperank.tech/api/outwardFacing/getPageRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245

*/
 
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

const getPageRankIfAvailable = async (observer:string) => {
  try {
    const params_get3 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: `customerData/${observer}/personalizedPageRank`,
    }

    const command_get3 = new GetObjectCommand(params_get3);
    const response_get3 = await client.send(command_get3);
    const sPageRank = await response_get3.Body?.transformToString()

    return sPageRank
  } catch (error) {
    console.log(error)
    return false
  }
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
      message: `api/outwardFacing/getPageRank: no observer was provided`
    }
    res.status(500).json(response)
  }
  if (!searchParams.observee) {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getPageRank: no observee was provided`
    }
    res.status(500).json(response)
  }
  const observer = searchParams.observer
  const observee = searchParams.observee  
  if (typeof observer == 'string' && verifyPubkeyValidity(observer) && typeof observee == 'string' && verifyPubkeyValidity(observee)) {
    try {
      const params_get0 = {
        Bucket: 'grapevine-nostr-cache-bucket',
        Key: `dataManagement/lookupSqlIdsByPubkey`,
      }
      const command_get0 = new GetObjectCommand(params_get0);
      const response_get0 = await client.send(command_get0);
      const sLookupSqlIdsByPubkey = await response_get0.Body?.transformToString()

      const sPageRank = await getPageRankIfAvailable(observer)

      let aPageRankScores:PprScores = []

      let observeeId = 'foo'
      let personalizedPageRankScore = -1
      if (sPageRank && typeof sPageRank == 'string' && sLookupSqlIdsByPubkey && typeof sLookupSqlIdsByPubkey == 'string') {
        const oLookupSqlIdsByPubkey = JSON.parse(sLookupSqlIdsByPubkey)
        observeeId = JSON.stringify(oLookupSqlIdsByPubkey[observee])

        const oPersonalizedPageRank:PPR = JSON.parse(sPageRank)
        aPageRankScores = oPersonalizedPageRank.data.scores
        for (let x=0; x < aPageRankScores.length; x++) {
          const oPageRankScore = aPageRankScores[x]
          const pk = oPageRankScore.pubkey
          const sc = oPageRankScore.score
          if (pk == observee) {
            personalizedPageRankScore = sc
          }
        }
      }

      const response:ResponseData = {
        success: true,
        exists: true,
        message: `api/outwardFacing/getPageRank data:`,
        data: {
          observer, observee, observeeId, typeofObserveeId: typeof observeeId, personalizedPageRankScore
        }
      }
      res.status(200).json(response)
    } catch (error) {
      const response = {
        success: false,
        message: `api/outwardFacing/getPageRank error: ${error}`,
        data: {
          observer,
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getPageRank: the provided observer and / or observee pubkey is invalid`,
      data: {
        observer, observee
      }
    }
    res.status(500).json(response)
  }
}