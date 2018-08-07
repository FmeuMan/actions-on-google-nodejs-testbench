import { GoogleCloudDialogflowV2WebhookResponse } from 'actions-on-google';
import { ApiClientObjectMap } from 'actions-on-google/dist/common';
import {
    GoogleCloudDialogflowV2Context,
    GoogleCloudDialogflowV2QueryResult,
    GoogleCloudDialogflowV2WebhookRequest
} from 'actions-on-google/dist/service/dialogflow/api/v2';
import { GoogleAssistantResponse } from 'actions-on-google/src/service/dialogflow/conv';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { Server } from 'http';
import { Response } from 'superagent';
import * as supertest from 'supertest';

export class DialogflowTestBench {

    private app: express.Express;
    private server: Server;

    public constructor(handler: any, options: { port?: number } = {}) {
        this.app = express();
        this.app.use(bodyParser.json());
        this.app.all('/', handler);
        this.server = this.app.listen(options.port || 3000);
    }

    public close() {
        return new Promise(resolve => {
            this.server.close(resolve)
        });
    }

    public newRequest(): supertest.Test {
        return supertest(this.server)
            .post('/')
            .timeout({deadline: 1000});
    }

    /**
     * Prepare a simple call to a given intent
     */
    public triggerIntent(intentId: string, options: IntentOptions = {}): DialogflowTest {
        return new DialogflowTest(this.newRequest()
            .send(DialogflowTestBench.buildDialogflowRequest(intentId, options)));
    }

    protected static buildDialogflowRequest(intentId: string,
        options: IntentOptions = {}): GoogleCloudDialogflowV2WebhookRequest {
        const outputContexts: GoogleCloudDialogflowV2Context[] = [];

        const queryResult: GoogleCloudDialogflowV2QueryResult = {
            action: intentId,
            intent: {
                displayName: intentId
            },
            languageCode: 'en',
            outputContexts
        };

        if (options.text) {
            queryResult.queryText = options.text;
        }
        if (options.parameters) {
            queryResult.parameters = options.parameters;
        }

        if (options.intentData) {
            outputContexts.push({
                name: 'projects/foo/agent/sessions/12345/contexts/_actions_on_google',
                lifespanCount: 100,
                parameters: {
                    data: JSON.stringify(options.intentData)
                }
            });
        }

        return {
            queryResult,
            originalDetectIntentRequest: {
                // version: 2,
                payload: {
                    surface: {
                        capabilities: [
                            {name: 'actions.capability.WEB_BROWSER'},
                            {name: 'actions.capability.AUDIO_OUTPUT'},
                            {name: 'actions.capability.SCREEN_OUTPUT'},
                            {name: 'actions.capability.MEDIA_RESPONSE_AUDIO'}
                        ]
                    }
                }
            }
        };
    }
}

/**
 * Decorator of superagent Test class to simplify tests of dialogflow
 */
export class DialogflowTest {

    private superagentTest: supertest.Test;

    public constructor(superagentTest: supertest.Test) {
        this.superagentTest = superagentTest;
    }

    /**
     * Wrapper of supertest Test.expect
     *
     * Expectations:
     *
     *   .expect(200)
     *   .expect(200, fn)
     *   .expect(200, body)
     *   .expect('Some body')
     *   .expect('Some body', fn)
     *   .expect('Content-Type', 'application/json')
     *   .expect('Content-Type', 'application/json', fn)
     *   .expect(fn)
     *
     * @return {Test}
     */
    public expect(a: any, b?: any, c?: any): supertest.Test {
        return this.superagentTest.expect(a, b, c);
    }

    /**
     * Wrapper of supertest Test.then and transform response
     * to a DialogflowResponse
     */
    public then<TResult1 = DialogflowResponse, TResult2 = never>(
        onfulfilled?: ((body: DialogflowResponse) => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null)
        : Promise<TResult1 | TResult2> {
        return this.superagentTest
            .then(DialogflowTest.buildDialogflowResponse)
            .then(onfulfilled, onrejected);
    }

    protected static buildDialogflowResponse(response: Response): DialogflowResponse {
        const body: GoogleCloudDialogflowV2WebhookResponse = response.body;
        const payload = body.payload && body.payload.google as GoogleAssistantResponse;
        const displayText: string[] = [];
        const textToSpeech: string[] = [];

        if (payload && payload.richResponse && payload.richResponse.items) {
            payload.richResponse.items.forEach(i => {
                if (i.simpleResponse) {
                    i.simpleResponse.displayText && displayText.push(i.simpleResponse.displayText);
                    i.simpleResponse.textToSpeech && textToSpeech.push(i.simpleResponse.textToSpeech);
                }
            });
        }

        return {
            response: response,
            body,
            expectUserResponse: !!payload && payload.expectUserResponse,
            displayText,
            textToSpeech
        };
    }
}

export interface IntentOptions {
    text?: string;
    parameters?: ApiClientObjectMap<any>;
    intentData?: { [key: string]: any; };
}

export interface DialogflowResponse {
    response: Response;
    body: GoogleCloudDialogflowV2WebhookResponse;
    expectUserResponse: boolean;
    displayText: string[];
    textToSpeech: string[];
}
