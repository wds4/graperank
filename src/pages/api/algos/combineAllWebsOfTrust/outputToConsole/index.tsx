import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Dos, PPR, PprScore, PprScores, ResponseData } from '@/types'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/combineAllWebsOfTrust/outputToConsole?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

type pubkey = string

type PwotScores = {[key:pubkey]: number[]}

type PwotData = {
  numPubkeysTotal: number,
  scores?:PwotScores, // PprScores
}

type PwotMetaData = {
  whenLastUpdated: {
    synthesis: number,
    dos: number,
    personalizedPageRank: number,
  },
  referencePubkey: string,
}

type PWoT = {
  metaData: PwotMetaData,
  data: PwotData
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/algos/combineAllWebsOfTrust/outputToConsole: pubkey was not provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      try {
        const params_get1 = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${pubkey1}/dos`,
        }

        const params_get2 = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${pubkey1}/personalizedPageRank`,
        }

        const command_get1 = new GetObjectCommand(params_get1);
        const response_get1 = await client.send(command_get1);
        const sDos = await response_get1.Body?.transformToString()
        
        const command_get2 = new GetObjectCommand(params_get2);
        const response_get2 = await client.send(command_get2);
        const sPPR = await response_get2.Body?.transformToString()

        if (typeof sDos == 'string' && typeof sPPR == 'string') {
          const oDos:Dos = JSON.parse(sDos)
          const oPPR:PPR = JSON.parse(sPPR)

          const aPubkeysByHop = oDos.data.pubkeysByDoS
          // const aPubkeysByHop = Object.keys(oDos.data.pubkeysByDoS)
          const aPPR:PprScores = oPPR.data.scores

          const oPwotScores:PwotScores = {}
          const oFoo:{[key:string]: { dos: number, personalPageRank: number, grapeRank_average: number, grapeRank_confidence: number }} = {}
          
          for (let hop=0; hop < aPubkeysByHop.length; hop++) {
            const aPubkeys = aPubkeysByHop[hop]
            for (let z=0; z < aPubkeys.length; z++) {
              const pk = aPubkeys[z]
              // oPwotScores[pk] = [hop, 0, 0, 0]
              oFoo[pk] = {
                dos: hop,
                personalPageRank: -1,
                grapeRank_average: -1,
                grapeRank_confidence: -1,
              }
            }
          }

          for (let x=0; x < aPPR.length; x++) {
            const oBar:PprScore = aPPR[x]
            const pk = oBar.pubkey
            const score = oBar.score
            if (oFoo[pk]) {
              oFoo[pk].personalPageRank = score
            } else {
              oFoo[pk] = {
                dos: 999,
                personalPageRank: score,
                grapeRank_average: -1,
                grapeRank_confidence: -1,
              }
            }
          }

          // TODO: add grapeRank scores

          const aFoo = Object.keys(oFoo)
          for (let a=0; a < aFoo.length; a++) {
            const pk = aFoo[a]
            oPwotScores[pk] = [ oFoo[pk].dos, oFoo[pk].personalPageRank, oFoo[pk].grapeRank_average, oFoo[pk].grapeRank_confidence ]
          }

          /*
          // go through oDos and oPPR to create the output object
          {
            pk1: [dos, personalPageRank, grapeRank_average, grapeRank_confidence],
            pk2 [dos, personalPageRank, grapeRank_average, grapeRank_confidence],
          }
          */

          /* PutObjectCommand */
          const currentTimestamp = Math.floor(Date.now() / 1000)
          const oPersonalizedWebsOfTrust:PWoT = {
            metaData: {
              whenLastUpdated: {
                synthesis: currentTimestamp,
                dos: oDos.metaData.whenLastUpdated,
                personalizedPageRank: oPPR.metaData.whenLastUpdated,
              },
              referencePubkey: pubkey1, 
            },
            data: {
              numPubkeysTotal: 0,
              scores: oPwotScores,
            },
          }

          const fooFxn = async (oPersonalizedWebsOfTrust:PWoT) => {
            const sOutput = JSON.stringify(oPersonalizedWebsOfTrust)
            return sOutput
          }

          const params_put = {
            Bucket: 'grapevine-nostr-cache-bucket',
            Key: `customerData/${pubkey1}/combinedWebsOfTrust`,
            Body: await fooFxn(oPersonalizedWebsOfTrust)
          }

          console.log(typeof params_put)

          // const command_put = new PutObjectCommand(params_put);
          // const response_put = await client.send(command_put);

          const response:ResponseData = {
            success: true,
            exists: true,
            message: `api/algos/combineAllWebsOfTrust/outputToConsole data:`,
            data: {
              oPersonalizedWebsOfTrust,
            }
          }
          res.status(200).json(response)
        } else {
          // error 
          const response = {
            success: false,
            message: `api/algos/combineAllWebsOfTrust/outputToConsole: data not available or not properly formatted`,
            data: {
              pubkey1,
            }
          }
          res.status(500).json(response)
        }

      } catch (error) {
        const response = {
          success: false,
          message: `api/algos/combineAllWebsOfTrust/outputToConsole error: ${error}`,
          data: {
            pubkey1,
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/algos/combineAllWebsOfTrust/outputToConsole: the provided pubkey is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/algos/combineAllWebsOfTrust/outputToConsole: pubkey was not provided`
    }
    res.status(500).json(response)
  }
}