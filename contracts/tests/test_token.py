"""token.cairo test file."""
import os

import pytest
import openzeppelin
from starkware.starknet.testing.starknet import Starknet
from starkware.starknet.wallets.open_zeppelin import OpenZeppelinAccount
from starkware.starknet.wallets.starknet_context import StarknetContext
from nile.signer import (
    Signer,
    from_call_to_call_array,
    get_transaction_hash,
    TRANSACTION_VERSION,
)
from nile.utils import MAX_UINT256, str_to_felt, to_uint

DEPLOY_CACHE = None
TOKEN_CONTRACT_FILE = os.path.join("contracts", "token.cairo")
ETH_TOKEN_CONTRACT_FILE = os.path.join(
    openzeppelin.__path__[0], "token", "erc20", "presets", "ERC20.cairo"
)
ACCOUNT_CONTRACT_FILE = os.path.join(
    openzeppelin.__path__[0], "account", "presets", "Account.cairo"
)
OWNER = 0x0339A8EBF38CE2950EC4B7027A179DBA328CD883F2E54DC0FABA2884269D970B
E_18 = int(1e18)

"""
Utility functions that probably shouldn't need to be reinvented by every damned project
"""


# def str_to_felt(text):
#     b_text = bytes(text, "ascii")
#     return int.from_bytes(b_text, "big")


def felt_to_str(felt):
    b_val = felt.to_bytes(felt.bit_length() + 7 // 8, "big")
    return b_val.lstrip(b"\x00").decode("ascii")


# def to_uint(a):
#     return (a & ((1 << 128) - 1), a >> 128)


@pytest.fixture(scope="session", autouse=True)
def get_context():
    async def deploy():
        global DEPLOY_CACHE

        if DEPLOY_CACHE is not None:
            return DEPLOY_CACHE

        starknet = await Starknet.empty()

        deployer_signer = Signer(1234567890)
        deployer = await starknet.deploy(
            source=ACCOUNT_CONTRACT_FILE,
            constructor_calldata=[deployer_signer.public_key],
        )

        deployer_address = deployer.contract_address

        # Deploy the contract.
        calldata = [
            str_to_felt("Starkgate ETH"),
            str_to_felt("ETH"),
            18,
            *to_uint(100000000000000000000000),
            deployer_address,
        ]
        print("calldata:", calldata)
        eth_token = await starknet.deploy(
            source=ETH_TOKEN_CONTRACT_FILE,
            # name: felt, symbol: felt, decimals: felt, initial_supply: Uint256, recipient: felt
            constructor_calldata=calldata,
        )
        assert (await eth_token.totalSupply().call()).result[0] == to_uint(
            100000000000000000000000
        )

        # Deploy the contract.
        contract = await starknet.deploy(
            source=TOKEN_CONTRACT_FILE,
            constructor_calldata=[
                # URI cannot be longer than 31 chars due to storage
                # limitations of Cairo (?)
                str_to_felt("https://cartquarter.test/m/"),
                deployer_address,
            ],
        )

        await contract.set_eth_token(eth_token.contract_address).execute(
            caller_address=deployer_address
        )

        assert (await contract.get_eth_token().call()).result[
            0
        ] == eth_token.contract_address

        await eth_token.approve(
            # infinite approval
            contract.contract_address,
            MAX_UINT256,
        ).execute(caller_address=deployer_address)

        DEPLOY_CACHE = (starknet, contract, eth_token, deployer_address)
        return DEPLOY_CACHE

    return deploy


@pytest.mark.asyncio
async def test_uri(get_context):
    """Test uri method."""
    _, contract, _, _ = await get_context()
    ret = await contract.uri((1, 1)).call()
    (uri,) = ret.result
    assert felt_to_str(uri) == "https://cartquarter.test/m/"


@pytest.mark.asyncio
async def test_owner(get_context):
    """Test owner method."""
    _, contract, _, deployer_address = await get_context()
    ret = await contract.owner().call()
    assert deployer_address == ret.result[0]


@pytest.mark.asyncio
async def test_create(get_context):
    """Test creating a sale."""
    _, contract, _, deployer_address = await get_context()
    type_id = to_uint(1234)

    await contract.create(
        id=type_id, max_price=to_uint(E_18), max_supply=to_uint(1234)
    ).execute(caller_address=deployer_address)

    assert (await contract.token_max_price(type_id).call()).result[
        0
    ] == to_uint(E_18)
    assert (await contract.token_max_supply(type_id).call()).result[
        0
    ] == to_uint(1234)
    assert (await contract.token_supply(type_id).call()).result[0] == to_uint(0)


@pytest.mark.asyncio
async def test_mint(get_context):
    """Test a mint."""
    _, contract, eth_token, deployer_address = await get_context()
    type_id = to_uint(2222)
    value = to_uint(1)
    max_price = E_18
    max_supply = 1234

    await contract.create(
        id=type_id, max_price=to_uint(max_price), max_supply=to_uint(max_supply)
    ).execute(caller_address=deployer_address)

    price = (await contract.mint_price(type_id).call()).result[0]
    print("--price:", price)
    assert price == to_uint((max_price // max_supply) * 1)

    await contract.mint(
        to=deployer_address, id=type_id, value=value, data=[]
    ).execute(caller_address=deployer_address)

    assert (await contract.balanceOf(deployer_address, type_id).call()).result[
        0
    ] == value


@pytest.mark.asyncio
async def test_mint_multiple(get_context):
    """Test minting multiple tokens."""
    _, contract, eth_token, deployer_address = await get_context()
    type_id = to_uint(3333)
    value = to_uint(5)

    await contract.create(
        id=type_id, max_price=to_uint(E_18), max_supply=to_uint(1234)
    ).execute(caller_address=deployer_address)

    await contract.mint(
        to=deployer_address, id=type_id, value=value, data=[]
    ).execute(caller_address=deployer_address)

    assert (await contract.balanceOf(deployer_address, type_id).call()).result[
        0
    ] == value


@pytest.mark.asyncio
async def test_burn(get_context):
    """Test minting multiple tokens."""
    _, contract, eth_token, deployer_address = await get_context()
    type_id = to_uint(5555)
    value = to_uint(3)

    await contract.create(
        id=type_id, max_price=to_uint(E_18), max_supply=to_uint(1234)
    ).execute(caller_address=deployer_address)

    await contract.mint(
        to=deployer_address, id=type_id, value=value, data=[]
    ).execute(caller_address=deployer_address)

    assert (await contract.balanceOf(deployer_address, type_id).call()).result[
        0
    ] == value

    original_eth = (await eth_token.balanceOf(deployer_address).call()).result[
        0
    ]

    await contract.burn(
        from_=deployer_address, id=type_id, value=to_uint(2)
    ).execute(caller_address=deployer_address)

    assert (await contract.balanceOf(deployer_address, type_id).call()).result[
        0
    ] == to_uint(1)

    assert (await eth_token.balanceOf(deployer_address).call()).result[
        0
    ] > original_eth
