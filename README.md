# Actions on Google integration tests library

A simple integration testing tool for Actions on google webhooks.
Currently support only dialogflow webhooks.

### Full example :
```js
// index.js
import { dialogflow } from 'actions-on-google';
import * as functions from 'firebase-functions';

const app = dialogflow({ debug: false });

app.intent('welcome', (conv) => {
    conv.ask('Hi! How can I help you ?');
});

exports.myAgent = functions.https.onRequest(app);
```

```js
// index.spec.js
const { DialogflowTestBench } = require('actions-on-google-nodejs-testbench');

const { myAgent } = require('./index');

describe('MyAgent', () => {

    let testBench;

    beforeAll(() => {
        testBench = new DialogflowTestBench(myAgent);
    });

    afterAll(() => {
        testBench.close();
    });

    describe('welcome intent', () => {
        it('should say hi', (done) => {
            testBench.triggerIntent('welcome')
                .then(response => {
                    const textToSpeech = response.textToSpeech.join('\n');
                    expect(textToSpeech).toMatch(/hi/i);
                    done();
                });
        });
    });
});
```
