// delay() wraps setTimeout (callback-based) in a Promise, so it can be used with await.
// shouldFail lets us simulate both success and failure cases for testing.
function delay(ms, shouldFail = false) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (shouldFail) {
                reject(new Error('Something went wrong'));
            } else {
                resolve();
            }
        }, ms);
    });
}

async function runDemo() {
    console.log('Start');
    try {
        // Change to delay(1000) or delay(1000, false) to see the success path instead.
        await delay(1000, true);
        console.log('End'); // skipped if delay() rejects — execution jumps to catch
    } catch (error) {
        // await on a rejected Promise throws — this is what actually gets caught here,
        // not an error inside delay() itself.
        console.log('Caught an error:', error.message);
    }
}

runDemo();