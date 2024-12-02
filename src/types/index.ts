export type ResponseData = {
    success: boolean,
    exists?: boolean,
    message: string,
    data?: object,
}

// DoS

type DosMetaData = {
  whenLastUpdated: number,
  referencePubkey: string,
  cypher: string,
}

export type NumPubkeysByDoS = {[key:string]: number}

export type PubkeysByDoS = string[][]

type DosData = {
  maxNumHops: number,
  numPubkeysTotal: number,
  numPubkeysByDoS: NumPubkeysByDoS,
  pubkeysByDoS:PubkeysByDoS,
}

export type Dos = {
  metaData: DosMetaData,
  data: DosData
}

// personalized pageRank

export type PprScores = []

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

export type PPR = {
  metaData: PprMetaData,
  data: PprData
}