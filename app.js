const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserDetails = `
  SELECT* 
  FROM user 
  WHERE username = '${username}';`;
  const dbUser = await database.get(selectUserDetails);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPassword = await bcrypt.compare(password, dbUser.password);

    if (isPassword !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      response.send({
        jwtToken,
      });
      console.log(jwtToken);
    }
  }
});

const authentication = (request, response, next) => {
  const authToken = request.headers["authorization"];
  let jwtToken;
  if (authToken !== undefined) {
    jwtToken = authToken.split(" ")[1];
  }
  if (authToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401)
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//STATE OBJECTS//
const changingState = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};

//DISTRICT OBJECTS//
const changeDistrict = (dObject) => {
  return {
    districtId: dObject.district_id,
    districtName: dObject.district_name,
    stateId: dObject.state_id,
    cases: dObject.cases,
    cured: dObject.cured,
    active: dObject.active,
    deaths: dObject.deaths,
  };
};

//API 2//
app.get("/states/", authentication, async (request, response) => {
  const getDetailsQuery = `
    SELECT *
    FROM 
        state;`;
  const dbResult = await database.all(getDetailsQuery);
  response.send(dbResult.map((each) => changingState(each)));
});

//API 3//
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getDetailsQuery = `
    SELECT *
    FROM 
        state
    WHERE state_id = ${stateId};`;
  const dbResult = await database.get(getDetailsQuery);
  response.send(changingState(dbResult));
});

//API 4//

app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const postDetailsQuery = `
    INSERT INTO district 
    (district_name, state_id, cases, cured, active, deaths)
    VALUES
    ('${districtName}',${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const postResult = await database.run(postDetailsQuery);
  response.send("District Successfully Added");
});

//API 5//

app.get("/districts/:districtId", authentication, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictDetails = `
    SELECT * 
    FROM 
        district
    WHERE 
        district_id = ${districtId};`;
  const dbDetails = await database.get(getDistrictDetails);
  response.send(changeDistrict(dbDetails));
});

//API 6//
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deletingPath = `
    DELETE FROM 
    district
    WHERE district_id = ${districtId};`;
    await database.run(deletingPath);
    response.send("District Removed");
  }
);

//API 7//
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
    UPDATE 
        district
    SET 
       district_name = '${districtName}',
       state_id = ${stateId},
       cases = ${cases},
       cured = ${cured},
       active = ${active},
       deaths = ${deaths}
    WHERE 
        district_id = ${districtId};`;
    await database.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API 8//
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const totalQuery = `
    SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    
    FROM district
    WHERE state_id = ${stateId}; `;

    const dbResult = await database.get(totalQuery);
    response.send(dbResult);
  }
);

module.exports = app;
