import Layer from 'express/lib/router/layer';

type GenericHandler = (req: any, res: any, next: any) => any;

const originalHandleRequest: GenericHandler = Layer.prototype.handle_request as GenericHandler;

Layer.prototype.handle_request = function handled(this: any, req: any, res: any, next: any) {
  const fn = this.handle as GenericHandler;

  if (fn.length > 3) {
    return next();
  }

  try {
    const result = fn.call(this, req, res, next);
    if (result && typeof result.then === 'function') {
      result.catch((err: unknown) => next(err));
    }
  } catch (err) {
    next(err);
  }
};