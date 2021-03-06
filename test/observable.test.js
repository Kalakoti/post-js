import test from "ava";
import {
  Store,
  observable,
  computed,
  autorun,
  action
} from "../src/observable";
import { OBSERVABLE, MAX_DEPTH } from "../src/constants";

test("observables should return value when called with no argument", t => {
  const test = observable("test");
  t.is(test(), "test");
});

test("observables should set a new value when called with an argument", t => {
  const test = observable("test");
  test("123");
  t.is(test(), "123");
});

test("observables no duplicate observations", t => {
  const test = observable("test");
  const comp = computed(() => {
    return `${test()}: ${test()}`;
  });
  t.is(comp(), "test: test");
  test("dupe");
  t.is(comp(), "dupe: dupe");
});

test("observables should not allow duplicate observer subscription", t => {
  let runs = 0;
  const reaction = {
    addDependency: () => {},
    run: () => runs++
  };
  const test = observable("test");
  test.subscribe(reaction);
  test.subscribe(reaction);
  test("update");
  t.is(runs, 1);
});

test("autorun should execute when observables it accesses change", t => {
  let count = 0;
  const test = observable("test");
  autorun(() => {
    let val = test();
    count++;
  });
  t.is(count, 1);
  test("123");
  t.is(count, 2);
});

test("autorun should stop executing after being disposed", t => {
  let count = 0;
  const test = observable("test");
  const dispose = autorun(() => {
    let val = test();
    count++;
  });
  t.is(count, 1);
  test("123");
  t.is(count, 2);
  dispose();
  test("456");
  t.is(count, 2);
});

test("computed values should update when dependencies update", t => {
  const test = observable("test");
  const test1 = observable("123");
  const comp = computed(() => {
    return `${test()} - ${test1()}`;
  });
  t.is(comp(), "test - 123");
  test("boom");
  t.is(comp(), "boom - 123");
});

/* no reason to throw here, we can safely ignore extra parameters sent to a computed value...
test("computed value should throw if you try to set it's value externally", t => {
  const test = observable("test");
  const test1 = observable("123");
  const comp = computed(() => {
    return `${test()} - ${test1()}`;
  });
  t.throws(() => {
    comp("error");
  });
});
*/

test("computed should stop and return only undefined after being disposed", t => {
  let count = 0;
  const test = observable("test");
  const test1 = observable("123");
  const comp = computed(() => {
    count++;
    return `${test()} - ${test1()}`;
  });
  t.is(count, 1);
  t.is(comp(), "test - 123");
  comp.dispose();
  test("boom");
  t.is(count, 1);
  t.is(comp(), undefined);
});

test("disposed observables should flush observers", t => {
  const test = observable("test");
  let count = 0;
  autorun(() => {
    count++;
    test();
  });
  t.is(count, 1);
  test.dispose();
  t.is(test(), undefined);
});

test("actions should batch observable updates", t => {
  const t1 = observable("Test1");
  const t2 = observable("Test2");
  const comp = computed(ctx => {
    return `${t1()} ${t2()}`;
  });
  t.is(t1(), "Test1");
  t.is(t2(), "Test2");
  t.is(comp(), "Test1 Test2");
  const act = action((ctx, one, two) => {
    t1(one);
    t2(two);
  });
  let count = 0;
  autorun(() => {
    count++;
    let res = comp();
  });
  act("Test-1", "Test-2");
  t.is(t1(), "Test-1");
  t.is(t2(), "Test-2");
  t.is(comp(), "Test-1 Test-2");
  t.is(count, 2);
  act("1", "2");
  t.is(t1(), "1");
  t.is(t2(), "2");
  t.is(comp(), "1 2");
  t.is(count, 3);
});

test("nested actions should only resolve after all actions finish", t => {
  const t1 = observable("Test1");
  const t2 = observable("Test2");
  const comp = computed(() => {
    return `${t1()} ${t2()}`;
  });
  const act2 = action(ctx => {
    t1("test-1");
    t2("test-2");
  });
  const act1 = action((ctx, one, two) => {
    t1(one);
    t2(two);
    act2();
  });
  t.is(t1(), "Test1");
  t.is(t2(), "Test2");
  t.is(comp(), "Test1 Test2");
  let count = 0;
  autorun(() => {
    count++;
    let res = comp();
  });
  act1("one", "two");
  t.is(t1(), "test-1");
  t.is(t2(), "test-2");
  t.is(comp(), "test-1 test-2");
  t.is(count, 2);
});

test("computeds that depend on other computed values should not output stale or glitch", t => {
  const count = observable(0);
  const first = observable("Andy");
  const last = observable("Johnson");
  const fullName = computed(ctx => {
    return `${first()} ${last()}`;
  });
  const fullCount = computed(ctx => {
    return `${fullName()}: ${count()}`;
  });
  t.is(count(), 0);
  t.is(first(), "Andy");
  t.is(last(), "Johnson");
  t.is(fullName(), "Andy Johnson");
  t.is(fullCount(), "Andy Johnson: 0");
  let a = 0;
  autorun(() => {
    a++;
    let test1 = fullName();
  });
  let b = 0;
  autorun(() => {
    b++;
    let test2 = fullCount();
  });
  t.is(a, 1);
  t.is(b, 1);
  const act = action(ctx => {
    count(1);
    first("John");
    last("Doe");
  });
  act();
  t.is(fullName(), "John Doe");
  t.is(fullCount(), "John Doe: 1");
  t.is(a, 2);
  t.is(b, 2);
});

test("observable array should return proxy that notifies observers on set", t => {
  const arr = observable([1, 2, 3, 4]);
  let count = 0;
  let sum = 0;
  autorun(() => {
    count++;
    sum = arr().reduce((acc, val) => {
      if (val == null) {
        return acc;
      } else if (val.type === OBSERVABLE) {
        return acc + val();
      }
      return acc + val;
    }, 0);
  });
  arr()[3] = 3;
  t.is(count, 2);
  t.is(sum, 9);
  arr()[10] = 1; // test that it also works on sparse arrays...
  t.is(count, 3);
  t.is(sum, 10);
  arr()[0] = 0;
  t.is(count, 4);
  t.is(sum, 9);
  arr()[3] = 5;
  t.is(count, 5);
  t.is(sum, 11);
  t.throws(() => {
    arr()["foo"] = false;
  });
});

test("observable array should trigger computed as expected", t => {
  const arr = observable([]);
  const comp = computed(ctx => {
    return arr().reduce((acc, val) => {
      return acc + val;
    }, 0);
  });
  arr().push(1);
  t.is(comp(), 1);
  arr().push(2);
  t.is(comp(), 3);
  arr().splice(1, 1);
  t.is(comp(), 1);
});

test("observable array should notify observers on mutator function execution", t => {
  const arr = observable([1, 2, 3, 4]);
  let count = 0;
  let sum = 0;
  autorun(() => {
    count++;
    sum = arr().reduce((acc, val) => {
      if (val == null) {
        return acc;
      } else if (val.type === OBSERVABLE) {
        return acc + val();
      }
      return acc + val;
    }, 0);
  });
  t.is(count, 1);
  arr().pop();
  t.is(count, 2);
  t.is(sum, 6);
});

test("updating an observable array should work as epxected", t => {
  const arr = observable([]);
  const reset = action(ctx => {
    arr([]);
  });
  t.deepEqual(arr(), []);
  arr([1, 2, 3]);
  t.deepEqual(arr(), [1, 2, 3]);
  reset();
  t.deepEqual(arr(), []);
});

test("observable array of observables should trigger on children and container updates", t => {
  const arr = observable([1, observable(2)]);
  let count = 0;
  let sum = 0;
  autorun(() => {
    count++;
    sum = arr().reduce((acc, val) => {
      if (val == null) {
        return acc;
      } else if (val.type === OBSERVABLE) {
        return acc + val();
      }
      return acc + val;
    }, 0);
  });
  t.is(count, 1);
  t.is(sum, 3);
  arr()[1] = 3;
  t.is(count, 3);
  t.is(sum, 4);
  arr()[1] = observable(2);
  t.is(count, 5);
  t.is(sum, 3);
});

test("circular dependencies should short circuit after MAX_DEPTH iterations", t => {
  let warns = 0;
  console.warn = () => warns++;
  const count1 = observable(0);
  const count2 = observable(0);
  const inc1 = action(ctx => count1(count1() + 1));
  const inc2 = action(ctx => count2(count2() + 1));
  const act = action(ctx => {
    inc1();
    inc2();
  });
  const comp1 = computed(() => {
    const newVal = `comp1: ${count1()}`;
    inc2();
    return newVal;
  });
  const comp2 = computed(ctx => {
    const newVal = `comp2: ${count2()}`;
    inc1();
    return newVal;
  });
  const comp3 = computed(ctx => {
    act();
    return `${comp1()} : ${comp2()}`;
  });
  autorun(() => {
    let c3 = comp3();
  });
  //act();
  t.is(warns, 1);
});
