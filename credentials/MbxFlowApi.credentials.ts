// © 2026 MediaBoxEnt Digital Studio LLC. MIT License, see LICENSE.
// MBX Flow™ — A product of MediaBoxEnt Technologies.
import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MbxFlowApi implements ICredentialType {
	name = 'mbxFlowApi';

	displayName = 'MBX Flow API';

	icon: Icon = 'file:mbxflow.svg';

	documentationUrl = 'https://mbxflow.com/developers/api';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'mbx_...',
			description:
				'Starts with mbx_. Create one in MBX Flow: Settings, Integrations, Connected apps. Included from the Pro plan.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://app.mbxflow.com/api/v1',
			url: '/me',
			method: 'GET',
		},
	};
}
