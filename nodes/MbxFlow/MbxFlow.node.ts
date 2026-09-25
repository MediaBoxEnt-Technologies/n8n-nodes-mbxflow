// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

import { mbxFlowApiRequest } from './GenericFunctions';
import {
	accountOptions,
	buildCreatePostBody,
	buildListPostsQuery,
	DEFAULT_LIMIT,
	MAX_LIMIT,
	type Account,
} from './helpers';

export class MbxFlow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MBX Flow',
		name: 'mbxFlow',
		icon: { light: 'file:mbxflow.svg', dark: 'file:mbxflow.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Save drafts and schedule posts in MBX Flow',
		defaults: {
			name: 'MBX Flow',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mbxFlowApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Post',
						value: 'post',
					},
				],
				default: 'post',
			},

			// ---- Account ----------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['account'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List the connected social accounts a post can go to',
						action: 'Get many accounts',
					},
				],
				default: 'getAll',
			},

			// ---- Post -------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['post'],
					},
				},
				options: [
					{
						name: 'Create Draft',
						value: 'createDraft',
						description: 'Save a post as a draft to finish in MBX Flow',
						action: 'Create a draft post',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get one post by its ID',
						action: 'Get a post',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List posts, newest first',
						action: 'Get many posts',
					},
					{
						name: 'Schedule',
						value: 'schedule',
						description: 'Schedule a post for a date and time at least 10 minutes ahead',
						action: 'Schedule a post',
					},
				],
				default: 'createDraft',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				required: true,
				default: '',
				description: 'What the post says. Up to 5000 characters.',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['createDraft', 'schedule'],
					},
				},
			},
			{
				displayName: 'Account Names or IDs',
				name: 'accountIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getAccounts',
				},
				required: true,
				default: [],
				description:
					'The accounts to publish to. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['schedule'],
					},
				},
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				required: true,
				default: '',
				description: 'When to publish. At least 10 minutes and at most one year from now.',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['schedule'],
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['createDraft'],
					},
				},
				options: [
					{
						displayName: 'Account Names or IDs',
						name: 'accountIds',
						type: 'multiOptions',
						typeOptions: {
							loadOptionsMethod: 'getAccounts',
						},
						default: [],
						description:
							'The accounts the draft is meant for. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Media URLs',
						name: 'mediaUrls',
						type: 'string',
						typeOptions: {
							rows: 2,
						},
						default: '',
						description:
							'Links to images or videos, one per line or separated by commas. Each must start with https://. Up to 10.',
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'scheduleFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['schedule'],
					},
				},
				options: [
					{
						displayName: 'Media URLs',
						name: 'mediaUrls',
						type: 'string',
						typeOptions: {
							rows: 2,
						},
						default: '',
						description:
							'Links to images or videos, one per line or separated by commas. Each must start with https://. Up to 10.',
					},
				],
			},
			{
				displayName: 'Post ID',
				name: 'postId',
				type: 'string',
				required: true,
				default: '',
				description: 'The ID of the post, as returned when it was created or listed',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: '',
				description: 'Only list posts with this status',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['getAll'],
					},
				},
				options: [
					{
						name: 'Any',
						value: '',
					},
					{
						name: 'Draft',
						value: 'draft',
					},
					{
						name: 'Failed',
						value: 'failed',
					},
					{
						name: 'Published',
						value: 'published',
					},
					{
						name: 'Scheduled',
						value: 'scheduled',
					},
				],
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: MAX_LIMIT,
				},
				default: 50,
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['getAll'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await mbxFlowApiRequest.call(this, 'GET', '/accounts');
				const accounts = (Array.isArray(response.accounts) ? response.accounts : []) as unknown as Account[];
				return accountOptions(accounts);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let results: IDataObject[] = [];

				if (resource === 'account' && operation === 'getAll') {
					const response = await mbxFlowApiRequest.call(this, 'GET', '/accounts', {}, i);
					results = (response.accounts as IDataObject[]) ?? [];
				} else if (resource === 'post' && (operation === 'createDraft' || operation === 'schedule')) {
					const text = this.getNodeParameter('text', i) as string;
					let body: Record<string, unknown>;
					try {
						if (operation === 'createDraft') {
							const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
							body = buildCreatePostBody('draft', {
								text,
								accountIds: extra.accountIds,
								mediaUrls: extra.mediaUrls,
							});
						} else {
							const extra = this.getNodeParameter('scheduleFields', i, {}) as IDataObject;
							body = buildCreatePostBody('schedule', {
								text,
								accountIds: this.getNodeParameter('accountIds', i, []),
								scheduledAt: this.getNodeParameter('scheduledAt', i),
								mediaUrls: extra.mediaUrls,
							});
						}
					} catch (error) {
						throw new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex: i });
					}
					const response = await mbxFlowApiRequest.call(this, 'POST', '/posts', { body }, i);
					results = [response.post as IDataObject];
				} else if (resource === 'post' && operation === 'get') {
					const postId = (this.getNodeParameter('postId', i) as string).trim();
					if (!postId) {
						throw new NodeOperationError(this.getNode(), 'Post ID is required.', { itemIndex: i });
					}
					const response = await mbxFlowApiRequest.call(
						this,
						'GET',
						`/posts/${encodeURIComponent(postId)}`,
						{},
						i,
					);
					results = [response.post as IDataObject];
				} else if (resource === 'post' && operation === 'getAll') {
					const qs = buildListPostsQuery(
						this.getNodeParameter('status', i, '') as string,
						this.getNodeParameter('limit', i, DEFAULT_LIMIT) as number,
					);
					const response = await mbxFlowApiRequest.call(this, 'GET', '/posts', { qs }, i);
					results = (response.posts as IDataObject[]) ?? [];
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for "${resource}".`,
						{ itemIndex: i },
					);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(results),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, {
					itemIndex: i,
					message: (error as Error).message,
					description: (error as NodeApiError).description ?? undefined,
				});
			}
		}

		return [returnData];
	}
}
