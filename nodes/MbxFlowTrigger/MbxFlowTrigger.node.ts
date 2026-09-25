// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
import {
	NodeConnectionTypes,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { mbxFlowApiRequest } from '../MbxFlow/GenericFunctions';
import { MAX_LIMIT, processPoll, statusForEvent, type PublicPost, type TriggerState } from '../MbxFlow/helpers';

export class MbxFlowTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MBX Flow Trigger',
		name: 'mbxFlowTrigger',
		icon: { light: 'file:mbxflow.svg', dark: 'file:mbxflow.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a post is published or fails in MBX Flow',
		defaults: {
			name: 'MBX Flow Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mbxFlowApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				default: 'postPublished',
				options: [
					{
						name: 'Post Failed',
						value: 'postFailed',
						description: 'A post could not be published',
					},
					{
						name: 'Post Published',
						value: 'postPublished',
						description: 'A post was published',
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const staticData = this.getWorkflowStaticData('node');

		const response = await mbxFlowApiRequest.call(this, 'GET', '/posts', {
			qs: { status: statusForEvent(event), limit: MAX_LIMIT },
		});
		const posts = (Array.isArray(response.posts) ? response.posts : []) as unknown as PublicPost[];

		const previous: TriggerState = {
			event: staticData.event as string | undefined,
			seenIds: staticData.seenIds as string[] | undefined,
		};
		const result = processPoll(previous, event, posts, this.getMode() === 'manual');

		staticData.event = result.state.event;
		staticData.seenIds = result.state.seenIds;

		if (!result.emit.length) return null;
		return [this.helpers.returnJsonArray(result.emit as unknown as IDataObject[])];
	}
}
