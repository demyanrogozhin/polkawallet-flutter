import { createType } from '@polkadot/types';
import WS from 'websocket';
import { assert, hexToU8a, u8aToHex } from '@polkadot/util';
import * as bs58 from 'bs58';
import { CustomTypes } from '../config/types';
import * as fixPoint from '../utils/fixpointUtil';

const { w3cwebsocket: WebSocket } = WS;
const _workers = new Map();
const registry = api.registry;

const RQ_NAMES = Object.keys(CustomTypes.TrustedGetter._enum);

const createTyped = (type, data) =>
  createType(registry, type, hexToU8a('0x'.concat(data)));

const parseBalance = data => {
  const dataTyped = createTyped('BalanceType', data);
  return fixPoint.parseI64F64(dataTyped.toBn());
};

const parseParticipantIndex = data => {
  const dataTyped = createTyped('ParticipantIndexType', data);
  return dataTyped.toNumber();
};

const parseAttestationIndex = data => {
  const dataTyped = createTyped('Vec<Attestation>', data);
  return dataTyped.toJSON();
};

const parseMeetupAssignment = data => {
  const dataTyped = createTyped('(MeetupIndexType, Option<Location>, Option<Moment>)', data);
  return dataTyped.toJSON();
};

function requestParams (address, shard) {
  return createType(registry, '(AccountId, CurrencyIdentifier)', [address, shard]);
}

function clientRequestGetter (cid, request) {
  const cidBin = u8aToHex(bs58.decode(cid));
  const getter = createType(registry, 'PublicGetter', {
    [request]: cidBin
  });
  const clientRq = createType(registry, 'ClientRequest', {
    StfState: [{ public: { getter } }, cidBin]
  });
  return clientRq.toU8a();
}

function clientRequestTrustedGetter (account, cid, request) {
  assert(RQ_NAMES.indexOf(request) !== -1, `Unknown request: ${request}`);
  const address = account.address;
  const cidBin = u8aToHex(bs58.decode(cid));
  const getter = createType(registry, 'TrustedGetter', {
    [request]: requestParams(address, cidBin)
  });
  const signature = account.sign(getter.toU8a());
  const clientRq = createType(registry, 'ClientRequest', {
    StfState: [
      {
        trusted: { getter, signature }
      },
      cidBin
    ]
  });
  return clientRq.toU8a();
}

export class Worker {
  constructor (url) {
    this.wsPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => resolve(this.ws);
      this.ws.onerror = () => reject(this.ws);
      this.ws.onclose = () => {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onopen = null;
        this.ws.onmessage = null;
      };
    });
  }

  isClosed () {
    return this.ws.readyState === this.ws.CLOSED || this.ws.readyState === this.ws.CLOSING;
  }

  isReady () {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === this.ws.CONNECTING) {
        this.wsPromise
          .then(ws => resolve(ws.readyState === ws.OPEN))
          .catch(ws => {
            const reason = ws.CLOSING ? 'ws closing' : 'ws closed';
            reject(reason);
          });
      } else {
        resolve(this.ws.readyState === this.ws.OPEN);
      }
    });
  }

  sendRequest (requestData, parse) {
    if (this.ws.onmessage) {
      return Promise.reject(new Error('worker can\'t handle parallel requests. please call getters sequentially'));
    } else {
      return new Promise((resolve, reject) => {
        const handleSuccess = resp => {
          if (resp.data === 'Could not decode request') {
            reject(resp.data);
          } else {
            resolve(parse(resp.data));
          }
          this.ws.onmessage = null;
          this.ws.onerror = null;
        };
        const handleError = err => {
          this.ws.onmessage = null;
          this.ws.onerror = null;
          reject(err);
        };
        this.ws.onmessage = handleSuccess;
        this.ws.onerror = handleError;

        this.wsPromise
          .then(ws => {
            ws.send(requestData);
          })
          .catch(reject);
      });
    }
  }

  getTotalIssuance (cid) {
    return this.sendRequest(clientRequestGetter(cid, 'total_issuance'), parseBalance);
  }

  getBalance (account, cid) {
    return this.sendRequest(clientRequestTrustedGetter(account, cid, 'balance'), parseBalance);
  }

  getRegistration (account, cid) {
    return this.sendRequest(clientRequestTrustedGetter(account, cid, 'registration'), parseParticipantIndex);
  }

  getMeetupIndexTimeAndLocation (account, cid) {
    return this.sendRequest(clientRequestTrustedGetter(account, cid, 'meetup_index_time_and_location'), parseMeetupAssignment);
  }

  getAttestations (account, cid) {
    return this.sendRequest(clientRequestTrustedGetter(account, cid, 'attestations'), parseAttestationIndex);
  }
}

export function useWorker (node) {
  let worker = _workers.get(node);
  if (!worker || worker.isClosed()) {
    worker = new Worker(node);
    _workers.set(node, worker);
  }
  return worker;
}