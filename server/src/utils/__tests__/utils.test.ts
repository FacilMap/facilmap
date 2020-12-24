import { throttle } from "../utils";

test('throttle', async () => {
    let runningNow = 0;

    const func = throttle(async (n: number): Promise<number> => {
        runningNow++;

        expect(runningNow).toBeLessThanOrEqual(3);

        await new Promise((resolve) => {
            setTimeout(resolve, 10);
        });

        expect(runningNow).toBeLessThanOrEqual(3);

        runningNow--;

        return n;
    }, 3);

    expect(await Promise.all([ func(1), func(2), func(3), func(4), func(5), func(6), func(7) ])).toEqual([1, 2, 3, 4, 5, 6, 7]);
});