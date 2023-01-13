import React, { useContext, useEffect, useState } from "react";
import { Button, Card, Col, Input, Form, Modal, Row } from "antd";
import { useAccount, useConnectors, useContract } from "@starknet-react/core";
import { uint256 } from "starknet";
import BN from "bn.js";

import { E_18, ETH_ADDRESS, tokenContract } from "./starknet";

export function Create({ close }) {
  const { account, address, status } = useAccount();
  const { contract } = useContract(tokenContract);

  function createTokenType({ id, maxPrice, maxSupply }) {
    const idU = uint256.bnToUint256(id);
    const maxPriceBN = new BN(maxPrice);
    const maxPriceU = uint256.bnToUint256(maxPriceBN.mul(E_18));
    const maxSupplyU = uint256.bnToUint256(maxSupply);
    contract
      .create(idU, maxPriceU, maxSupplyU)
      .then((res) => console.log("res:", res));
    // close()
  }

  return (
    <Form
      name="basic"
      labelCol={{ span: 8 }}
      wrapperCol={{ span: 16 }}
      initialValues={{ remember: true }}
      onFinish={createTokenType}
      onFinishFailed={() => console.error("failed")}
      autoComplete="off"
    >
      <Form.Item label="ID" name="id" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item
        label="Max Price ETH"
        name="maxPrice"
        rules={[{ required: true }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Max Supply"
        name="maxSupply"
        rules={[{ required: true }]}
      >
        <Input />
      </Form.Item>

      <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
        <Button type="primary" htmlType="submit">
          Create
        </Button>
      </Form.Item>
    </Form>
  );
}

export function CreateButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsModalOpen(true)}>Create</Button>
      <Modal
        title="Create Token Type"
        open={isModalOpen}
        onOk={() => setIsModalOpen(false)}
        onCancel={() => setIsModalOpen(false)}
      >
        <Create close={() => setIsModalOpen(false)} />
      </Modal>
    </>
  );
}

export function SetETHButton() {
  const { contract } = useContract(tokenContract);

  return (
    <>
      <Button
        onClick={() => {
          contract
            .set_eth_token(ETH_ADDRESS)
            .then((res) => console.log("res:", res));
        }}
      >
        Set ETH Token
      </Button>
    </>
  );
}
