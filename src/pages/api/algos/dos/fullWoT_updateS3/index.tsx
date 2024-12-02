import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'


/*
calculate DoS for all pubkeys relative to the reference pubkey, provided as pubkey1

update S3 endpoint:
customerData/<pk_customer>/dos

usage:
pubkey1: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/dos/fullWoT_updateS3?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

type ResponseData = {
  success: boolean,
  exists?: boolean,
  message: string,
  data?: object,
}

type DosMetaData = {
  whenLastUpdated: number,
  referencePubkey: string,
  cypher: string,
}

type NumPubkeysByDoS = {[key:string]: number}
type PubkeysByDoS = string[][]

type DosData = {
  maxNumHops: number,
  numPubkeysTotal: number,
  numPubkeysByDoS: NumPubkeysByDoS,
  pubkeysByDoS:PubkeysByDoS,
}

type Dos = {
  metaData: DosMetaData,
  data: DosData
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/algos/dos/fullWoT_updateS3: pubkey was not provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      const cypher1 = `MATCH p = shortestPath((r:NostrUser {pubkey: '${pubkey1}'})-[:FOLLOWS*]->(n:NostrUser))
WHERE r.pubkey <> n.pubkey 
RETURN n, length(p) as numHops`
      try {
        const result_cypher1 = await read(cypher1, {})
        console.log(result_cypher1)

        const aResults = JSON.parse(JSON.stringify(result_cypher1))

        const pubkeysByDoS:PubkeysByDoS = []
        pubkeysByDoS[0] = []
        pubkeysByDoS[0].push(pubkey1)
        let maxNumHops = 0
        for (let x=0; x < aResults.length; x++) {
          const numHops = aResults[x].numHops.low
          if (!pubkeysByDoS[numHops]) {
            pubkeysByDoS[numHops] = []
          }
          const pk = aResults[x].n.properties.pubkey
          pubkeysByDoS[numHops].push(pk)
          maxNumHops = Math.max(maxNumHops, numHops)
        }

        const numPubkeysByDoS:NumPubkeysByDoS = {}
        let numPubkeysTotal = 0
        for (let x=0; x <= maxNumHops; x++) {
          const foo = 'numHops_' + x.toString()
          numPubkeysByDoS[foo] = pubkeysByDoS[x].length
          numPubkeysTotal += pubkeysByDoS[x].length
        }

        const currentTimestamp = Math.floor(Date.now() / 1000)

        const oDos:Dos = {
          metaData: {
            whenLastUpdated: currentTimestamp,
            referencePubkey: pubkey1, 
            cypher: cypher1,
          },
          data: {
            maxNumHops,
            numPubkeysTotal,
            numPubkeysByDoS,
            pubkeysByDoS,
          },
        }

        /* PutObjectCommand */
        const fooFxn = async (oDos:Dos) => {
          const sOutput = JSON.stringify(oDos)
          return sOutput
        }

        const params_put = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${pubkey1}/dos`,
          Body: await fooFxn(oDos)
        }

        const command_put = new PutObjectCommand(params_put);
        const response_put = await client.send(command_put);

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/algos/dos/fullWoT_updateS3 data:`,
          data: {
            response_put, oDos,
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/algos/dos/fullWoT_updateS3 error: ${error}`,
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
        message: `api/algos/dos/fullWoT_updateS3: one or both of the provided pubkeys is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/algos/dos/fullWoT_updateS3: pubkey was not provided`
    }
    res.status(500).json(response)
  }
}