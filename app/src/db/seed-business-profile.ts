import bcrypt from "bcryptjs";
import { servicePool } from "./pool.js";

/**
 * Seeds ONE demonstration business profile, explicitly labelled as such —
 * not a real customer. Same fleet/profile shape used in the earlier static
 * prototype (prototype/fleet-radar.html), now a real database row a real
 * matching engine runs against. See docs/architecture/04-implementation-status.md.
 */
async function main() {
  const businessRes = await servicePool.query(
    `insert into businesses (name) values ($1)
     on conflict do nothing
     returning id`,
    ["NRS Services Ltd (demonstration profile — not a real customer)"],
  );

  let businessId: string;
  if (businessRes.rowCount) {
    businessId = businessRes.rows[0].id;
  } else {
    const existing = await servicePool.query(
      `select id from businesses where name = $1`,
      ["NRS Services Ltd (demonstration profile — not a real customer)"],
    );
    businessId = existing.rows[0].id;
  }

  await servicePool.query(
    `insert into business_profiles
       (business_id, services, fleet, base_location, operating_radius_miles,
        capacity_available, min_opportunity_value, preferred_sectors, rates)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (business_id) do update set
       services = excluded.services, fleet = excluded.fleet,
       base_location = excluded.base_location,
       operating_radius_miles = excluded.operating_radius_miles,
       capacity_available = excluded.capacity_available,
       min_opportunity_value = excluded.min_opportunity_value,
       preferred_sectors = excluded.preferred_sectors,
       rates = excluded.rates, updated_at = now()`,
    [
      businessId,
      ["Aggregate haulage", "Waste haulage", "Muck-away"],
      JSON.stringify([
        { type: "8-wheel tipper", count: 14 },
        { type: "Articulated tipper", count: 7 },
        { type: "Grab vehicle", count: 4 },
      ]),
      "Tamworth",
      100,
      20,
      25000,
      ["Construction", "Infrastructure", "Aggregates", "Quarrying", "Waste", "Earthworks"],
      JSON.stringify({
        payload: 20,
        pricePerTonne: 8.5,
        pricePerMile: 3.2,
        fuelPerMile: 0.95,
        driverPerDay: 220,
        minMargin: 18,
      }),
    ],
  );

  const passwordHash = await bcrypt.hash("demo-password-change-me", 10);
  const userRes = await servicePool.query(
    `insert into users (email, password_hash) values ($1, $2)
     on conflict (email) do update set password_hash = excluded.password_hash
     returning id`,
    ["demo@nrs-services.example", passwordHash],
  );
  const userId = userRes.rows[0].id;

  await servicePool.query(
    `insert into user_businesses (user_id, business_id, role) values ($1, $2, 'owner')
     on conflict do nothing`,
    [userId, businessId],
  );

  await servicePool.query(
    `insert into credits (business_id, balance) values ($1, 10)
     on conflict (business_id) do nothing`,
    [businessId],
  );
  await servicePool.query(
    `insert into credit_transactions (business_id, delta, reason) values ($1, 10, 'signup_grant')`,
    [businessId],
  );

  console.log("Seeded demonstration business:", businessId);
  console.log("Login: demo@nrs-services.example / demo-password-change-me");
  await servicePool.end();
}

main();
