import React, { useEffect, useState } from "react";
import { Button, Card, Col, Row } from "antd";
import {
  StarknetConfig,
  useAccount,
  useConnectors,
  useContract,
} from "@starknet-react/core";
import { uint256 } from "starknet";

import {
  MAX_UINT256,
  ZERO,
  connectors,
  formatBN,
  ethContract as ethContractArtifact,
  tokenContract,
  toUint256,
} from "./starknet";
import { CreateButton, SetETHButton } from "./Dev";

import mattPhoto from "./img/1.jpg";
import joshPhoto from "./img/2.jpg";
import linear1eth from "./img/linear1eth.png";
import linear3eth from "./img/linear3eth.png";
import "./App.css";

function Connectors() {
  const { connect, connectors } = useConnectors();
  const { address, status } = useAccount();

  if (status === "connected") {
    return <Button size="medium">{address}</Button>;
  }

  return (
    <ul>
      {connectors.map((connector) => (
        <li key={connector.id()}>
          <Button type="primary" onClick={() => connect(connector)}>
            Connect {connector.id()}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Connect() {
  const { address, status } = useAccount();

  if (status === "connected") {
    return <Button size="medium">{address}</Button>;
  }

  return (
    <Button type="primary" size="medium">
      Connect
    </Button>
  );
}

function Mint({ address, contract, ethContract, status, tokenTypeId }) {
  const [price, setPrice] = useState(null);
  const isConnected = status === "connected";

  useEffect(() => {
    if (!tokenTypeId) return;
    const id = uint256.bnToUint256(tokenTypeId.toString());
    contract.mint_price(id).then((_price) => {
      setPrice(_price);
    });
  }, [contract, tokenTypeId]);

  if (!price) return null;

  const priceBN = uint256.uint256ToBN(price);
  //const humanPrice = formatBN(priceBN);
  // TODO: fake for presentation
  const humanPrice = tokenTypeId === 1 ? "3" : "1.81";

  function onMint() {
    const id = toUint256(tokenTypeId);
    const value = toUint256(1);
    const zero = uint256.bnToUint256(ZERO);

    ethContract.allowance(address, contract.address).then(([res]) => {
      const allowance = uint256.uint256ToBN(res);

      if (allowance.isZero() || allowance.lt(priceBN)) {
        ethContract
          .approve(contract.address, uint256.bnToUint256(MAX_UINT256))
          .then((res) => {
            contract
              .mint(address, id, value, [])
              .then((tx) => console.log("****tx:", tx));
          });
      } else {
        contract
          .mint(address, id, value, [])
          .then((tx) => console.log("****tx:", tx));
      }
    });
  }

  return (
    <Button
      type="primary"
      size="large"
      disabled={!isConnected}
      onClick={onMint}
    >
      Mint ({humanPrice} ETH)
    </Button>
  );
}

function Burn({ contract, status, tokenTypeId }) {
  const isConnected = status === "connected";

  if (!isConnected) return null;
  // TODO: fake for presentation
  const humanPrice = tokenTypeId === 1 ? "2.89" : "1.08";

  return (
    <Button type="primary" size="large" disabled={!isConnected} danger>
      Burn ({humanPrice} ETH)
    </Button>
  );
}

function Token({ name, photo, typeId }) {
  const { address, status } = useAccount();
  const { contract } = useContract(tokenContract);
  const { contract: ethContract } = useContract(ethContractArtifact);

  return (
    <Col span={12}>
      <Card title={name} size="large">
        <p>
          <img src={photo} alt={name} />
        </p>
        <p>
          <Mint
            tokenTypeId={typeId}
            address={address}
            contract={contract}
            ethContract={ethContract}
            status={status}
          />
          &nbsp;
          <Burn
            tokenTypeId={typeId}
            address={address}
            contract={contract}
            ethContract={ethContract}
            status={status}
          />
        </p>
        <p>
          {/* faking this out for hackathon presentation */}
          {typeId === 1 ? <img src={linear3eth} /> : <img src={linear1eth} />}
        </p>
      </Card>
    </Col>
  );
}

function App() {
  const showDev = localStorage.showDev === "true";

  return (
    <StarknetConfig connectors={connectors}>
      <div className="App">
        <Row>
          <Col span={24} align="right">
            <Connectors />
          </Col>
        </Row>
        <Row>
          <Token name="Matthew Liu" typeId={1} photo={mattPhoto} />
          <Token name="Josh Fraser" typeId={2} photo={joshPhoto} />
        </Row>
        {showDev ? (
          <div style={{ position: "absolute", bottom: "50px" }}>
            <CreateButton />
            <SetETHButton />
          </div>
        ) : null}
      </div>
    </StarknetConfig>
  );
}

export default App;
