jest.mock('../../services/authService', () => ({}));

const { requireBakeryProduction } = require('../../middleware/userAccess');

// The kitchen's stock actions (receive, undo, cancel, edit a production line) are
// for production, staff and admin. Delivery and accounting have no part in them.
describe('requireBakeryProduction', () => {
  const call = (role) => {
    const next = jest.fn();
    const run = () => requireBakeryProduction({ user: { role } }, {}, next);
    return { run, next };
  };

  it.each(['bakery_staff', 'bakery_admin', 'system_admin', 'production_assistant'])(
    'lets %s through',
    (role) => {
      const { run, next } = call(role);

      run();

      expect(next).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['delivery_assistant', 'accounting_assistant', 'bakery_customer', undefined])(
    'refuses %s',
    (role) => {
      const { run, next } = call(role);

      expect(run).toThrow(/production/);
      expect(next).not.toHaveBeenCalled();
    },
  );
});
