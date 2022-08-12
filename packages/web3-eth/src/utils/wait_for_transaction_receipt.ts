/*
This file is part of web3.js.

web3.js is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

web3.js is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/
import { EthExecutionAPI, Bytes, TransactionReceipt } from 'web3-types';
import { Web3Context } from 'web3-core';
import { DataFormat, isNullish } from 'web3-utils';

// eslint-disable-next-line import/no-cycle
import { getBlockNumber, getTransactionReceipt } from '../rpc_method_wrappers';
import { TransactionBlockTimeoutError, TransactionPollingTimeoutError } from '../errors';
import { NUMBER_DATA_FORMAT } from '../constants';

export async function waitForTransactionReceipt<ReturnFormat extends DataFormat>(
	web3Context: Web3Context<EthExecutionAPI>,
	transactionHash: Bytes,
	returnFormat: ReturnFormat,
): Promise<TransactionReceipt> {
	const starterBlockNumber = await getBlockNumber(web3Context, NUMBER_DATA_FORMAT);
	const pollingInterval =
		web3Context.transactionReceiptPollingInterval ?? web3Context.transactionPollingInterval;
	return new Promise<TransactionReceipt>((resolve, reject) => {
		let transactionPollingDuration = 0;
		const intervalId = setInterval(() => {
			(async () => {
				transactionPollingDuration += pollingInterval;

				if (transactionPollingDuration >= web3Context.transactionPollingTimeout) {
					clearInterval(intervalId);
					reject(
						new TransactionPollingTimeoutError({
							numberOfSeconds: web3Context.transactionPollingTimeout / 1000,
							transactionHash,
						}),
					);
					return;
				}

				const lastBlockNumber = await getBlockNumber(web3Context, NUMBER_DATA_FORMAT);
				const numberOfBlocks = lastBlockNumber - starterBlockNumber;
				if (numberOfBlocks >= web3Context.transactionBlockTimeout) {
					clearInterval(intervalId);
					throw new TransactionBlockTimeoutError({
						starterBlockNumber,
						numberOfBlocks,
						transactionHash,
					});
				}

				const response = await getTransactionReceipt(
					web3Context,
					transactionHash,
					returnFormat,
				);

				if (!isNullish(response)) {
					clearInterval(intervalId);
					resolve(response);
				}
			})() as unknown;
		}, pollingInterval);
	});
}
