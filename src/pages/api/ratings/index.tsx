// import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
// import { S3Client } from '@aws-sdk/client-s3'
import { ResponseData } from '@/types'
import { Pubkey } from '@/types/ratingsApi'

/*
usage:
rators: [e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f]
https://www.graperank.tech/api/ratings?rators=["e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f"]&ratingKind=3&dos=0&networkKind=3

*/

/*
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})
*/

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  let rators:Pubkey[] = ['unknown']
  let ratingKind = -1
  let dos = 1
  let networkKind = -1

  try {
    if (typeof searchParams.rators == 'string' ) {
      rators = JSON.parse(searchParams.rators)
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/ratings: rators was not provided`
      }
      res.status(500).json(response)
    }
    
    if (typeof searchParams.ratingKind == 'string') {
      ratingKind = Number(searchParams.ratingKind)
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/ratings: ratingKind was not provided`
      }
      res.status(500).json(response)
    }

    if (typeof searchParams.dos == 'string') {
      dos = Number(searchParams.dos)
    }

    if (typeof searchParams.networkKind == 'string') {
      networkKind = Number(searchParams.networkKind)
    } else {
      networkKind = ratingKind
    }

    if (networkKind == 3) {
      if (ratingKind == 3) {
        const cypher1 = `MATCH (r:NostrUser {pubkey: 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f'})-[:FOLLOWS*1..3]->(n:NostrUser)
        RETURN n`

        const result_cypher1 = await read(cypher1, {})
        console.log(result_cypher1)

        const aResults = JSON.parse(JSON.stringify(result_cypher1))

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/ratings data:`,
          data: {
            rators, ratingKind, dos, networkKind, aResults
          }
        }
        res.status(200).json(response)
      }
    }

    const response:ResponseData = {
      success: true,
      exists: true,
      message: `api/ratings data:`,
      data: {
        rators, ratingKind, dos, networkKind
      }
    }
    res.status(200).json(response)
  } catch (error) {
    const response = {
      success: false,
      message: `api/ratings error: ${error}`,
    }
    res.status(500).json(response)
  }
}