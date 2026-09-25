// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { apiErrorMessage, buildRequest, isErrorStatus, type HttpMethod } from './helpers';

export const CREDENTIAL_NAME = 'mbxFlowApi';

export async function mbxFlowApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	method: HttpMethod,
	path: string,
	options: { qs?: Record<string, string | number>; body?: Record<string, unknown> } = {},
	itemIndex?: number,
): Promise<IDataObject> {
	const request = buildRequest(method, path, options) as unknown as IHttpRequestOptions;

	let response: IN8nHttpFullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIAL_NAME,
			request,
		)) as IN8nHttpFullResponse;
	} catch (error) {
		// No answer at all (network, DNS, timeout).
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	const body = (response.body ?? {}) as unknown;
	if (isErrorStatus(response.statusCode)) {
		const message = apiErrorMessage(response.statusCode, body);
		const errorBody: JsonObject =
			body && typeof body === 'object' ? (body as JsonObject) : { error: message };
		throw new NodeApiError(this.getNode(), errorBody, {
			message,
			httpCode: String(response.statusCode),
			itemIndex,
		});
	}
	return (body && typeof body === 'object' ? body : {}) as IDataObject;
}
