import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { GrapeRank, ResponseData, Scorecards } from '@/types'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

/*
Given an observer and observee, this endpoint returns the GrapeRank score of the observee, if it has been calculated for the observer.
If not, return exists: false.

usage:
observer: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
observee: d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d // 3 hops away
observee: c06885ce21d132b3c29e74aea9f4c171a95b2ed56bafac58a5fbfc9bdc5fbb06 // 3 hops away
observee: 1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b // 2 hops away
observee: cbaa0c829ed322c1551cb6619b4c08b9a26ac97ffb4e959205eec78ee9313245 // 1 hop away

https://www.graperank.tech/api/outwardFacing/getGrapeRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d

https://www.graperank.tech/api/outwardFacing/getGrapeRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=c06885ce21d132b3c29e74aea9f4c171a95b2ed56bafac58a5fbfc9bdc5fbb06

https://www.graperank.tech/api/outwardFacing/getGrapeRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b

https://www.graperank.tech/api/outwardFacing/getGrapeRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=cbaa0c829ed322c1551cb6619b4c08b9a26ac97ffb4e959205eec78ee9313245

https://www.graperank.tech/api/outwardFacing/getGrapeRank?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245

*/
 
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

type Scorecard_custom = {
  influence: number,
  average: number,
  confidence: number,
  input: number,
}

const getGrapeRankIfAvailable = async (observer:string) => {
  try {
    const params_get3 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: `customerData/${observer}/graperank`,
    }

    const command_get3 = new GetObjectCommand(params_get3);
    const response_get3 = await client.send(command_get3);
    const sGrapeRank = await response_get3.Body?.transformToString()

    return sGrapeRank
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
      message: `api/outwardFacing/getGrapeRank: no observer was provided`
    }
    res.status(500).json(response)
  }
  if (!searchParams.observee) {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getGrapeRank: no observee was provided`
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
      
      let oScorecard:Scorecard_custom = {
        influence: 0,
        average: 0,
        confidence: 0,
        input: 0,
      }

      const sGrapeRank = await getGrapeRankIfAvailable(observer)

      let observeeId = 'foo'
      if (sGrapeRank && typeof sGrapeRank == 'string' && sLookupSqlIdsByPubkey && typeof sLookupSqlIdsByPubkey == 'string') {
        const oLookupSqlIdsByPubkey = JSON.parse(sLookupSqlIdsByPubkey)
        observeeId = oLookupSqlIdsByPubkey[observee]

        const oGrapeRank:GrapeRank = JSON.parse(sGrapeRank)
        const oScorecards:Scorecards = oGrapeRank.data.scorecards
        const aGrapeRank = Object.keys(oScorecards)
        if (aGrapeRank.includes(observeeId)) {
          oScorecard = {
            influence: 1,
            average: 1,
            confidence: 1,
            input: 1,
          }
        } else {
          oScorecard = {
            influence: 2,
            average: 2,
            confidence: 2,
            input: 2,
          }
        }
        // TODO: finish extracting grapeRank scores from S3

      }



      



      const response:ResponseData = {
        success: true,
        exists: true,
        message: `api/outwardFacing/getGrapeRank data:`,
        data: {
          observer, observee, observeeId, typeofObserveeId: typeof observeeId, grapeRank: oScorecard,
        }
      }
      res.status(200).json(response)
    } catch (error) {
      const response = {
        success: false,
        message: `api/outwardFacing/getGrapeRank error: ${error}`,
        data: {
          observer,
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getGrapeRank: the provided observer and / or observee pubkey is invalid`,
      data: {
        observer, observee
      }
    }
    res.status(500).json(response)
  }
}