%lang starknet

from starkware.cairo.common.bool import TRUE
from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.uint256 import Uint256, assert_uint256_lt, uint256_add, uint256_sub
from starkware.cairo.common.math import assert_lt, assert_nn, assert_nn_le
from starkware.starknet.common.syscalls import get_caller_address, get_contract_address, get_tx_info

from openzeppelin.security.safemath.library import SafeUint256
from openzeppelin.token.erc20.IERC20 import IERC20
from openzeppelin.token.erc1155.presets.ERC1155MintableBurnable import (
    ERC1155,
    Ownable,
    constructor,
    supportsInterface,
    uri,
    balanceOf,
    balanceOfBatch,
    isApprovedForAll,
    owner,
    setApprovalForAll,
    safeTransferFrom,
    safeBatchTransferFrom,
    transferOwnership,
    renounceOwnership
)

struct Sale {
    max_price: Uint256,
    max_supply: Uint256,
    supply: Uint256,
}

@storage_var
func eth_token() -> (res: felt) {
}

@storage_var
func sale(id: Uint256) -> (res: Sale) {
}

@view
func get_eth_token{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (
    address: felt
) {
    let (_eth_token) = eth_token.read();
    return (address=_eth_token);
}

@view
func token_max_price{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(id: Uint256) -> (
    supply: Uint256
) {
    let (_sale) = sale.read(id);
    return (supply=_sale.max_price);
}

@view
func token_max_supply{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(id: Uint256) -> (
    supply: Uint256
) {
    let (_sale) = sale.read(id);
    return (supply=_sale.max_supply);
}

@view
func token_supply{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(id: Uint256) -> (
    supply: Uint256
) {
    let (_sale) = sale.read(id);
    return (supply=_sale.supply);
}

func price{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(max_price: Uint256, max_supply: Uint256, supply: Uint256) -> (
    value: Uint256
) {
    // TODO: using linear steps, maybe implement sigmoidal if there's time
    let (step, _) = SafeUint256.div_rem(max_price, max_supply);
    let (val) = SafeUint256.mul(supply, step);
    return (value=val);
}

@view
func mint_price{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(id: Uint256) -> (
    value: Uint256
) {
    let (_sale) = sale.read(id);
    // checking the price for supply + 1
    let (check_supply, _) = uint256_add(_sale.supply, Uint256(1, 0));
    let (amount) = price(_sale.max_price, _sale.max_supply, check_supply);
    return (value=amount);
}

@view
func burn_price{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(id: Uint256) -> (
    value: Uint256
) {
    let (_sale) = sale.read(id);
    let (amount) = price(_sale.max_price, _sale.max_supply, _sale.supply);
    return (value=amount);
}

@view
func supply{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(id: Uint256) -> (
    amount: Uint256
) {
    let (_sale) = sale.read(id);
    return (amount=_sale.supply);
}

@external
func set_eth_token{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    address: felt
) {
    // TODO: Would be lovely to set this in the constructor, but apparently the preset conflicts?
    eth_token.write(address);
    return ();
}

@external
func create{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    id: Uint256, max_price: Uint256, max_supply: Uint256
) {
    Ownable.assert_only_owner();
    let _sale = Sale(max_price=max_price, max_supply=max_supply, supply=Uint256(0, 0));
    sale.write(id, _sale);
    return ();
}

@external
func mint{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    to: felt, id: Uint256, value: Uint256, data_len: felt, data: felt*
) {
    alloc_locals;
    let (local _sale) = sale.read(id);

    // Check for the existance of the sale
    assert_uint256_lt(Uint256(0, 0), _sale.max_supply);

    let (caller_address) = get_caller_address();
    let (self) = get_contract_address();
    let (current_price) = mint_price(id);
    let (local _eth_token) = eth_token.read();

    let (success : felt) = IERC20.transferFrom(
        contract_address=_eth_token, sender=caller_address, recipient=self, amount=current_price
    );

    with_attr error_message("Transfer failed"){
        assert success = TRUE;
    }

    ERC1155._mint(to, id, value, data_len, data);

    // TODO: Second return is "carry".  Overrun?  Unclear what it is.
    let (new_supply, _) = uint256_add(_sale.supply, Uint256(1, 0));
    sale.write(
        id,
        Sale(max_price=_sale.max_price, max_supply=_sale.max_supply, supply=new_supply)
    );

    return ();
}

@external
func burn{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    from_: felt, id: Uint256, value: Uint256
) {
    alloc_locals;
    ERC1155.assert_owner_or_approved(owner=from_);
    let (local _sale) = sale.read(id);

    // Check for the existance of the sale
    assert_uint256_lt(Uint256(0, 0), _sale.max_supply);

    let (caller_address) = get_caller_address();
    let (current_price) = burn_price(id);
    let (local _eth_token) = eth_token.read();

    let (success: felt) = IERC20.transfer(
        contract_address=_eth_token, recipient=caller_address, amount=current_price
    );

    with_attr error_message("Transfer failed"){
        assert success = TRUE;
    }

    ERC1155._burn(from_, id, value);

    let (new_supply) = uint256_sub(_sale.supply, Uint256(1, 0));
    sale.write(
        id,
        Sale(max_price=_sale.max_price, max_supply=_sale.max_supply, supply=new_supply)
    );

    return ();
}
