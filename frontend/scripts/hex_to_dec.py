def hex_to_wei(hex_value):
    return int(hex_value, 16)


def wei_to_gwei(wei_value):
    return wei_value / 1e9


gas_values = {
    "fast_maxFeePerGas": "0x10cbeb",
    "fast_maxPriorityFeePerGas": "0x10c8e0",
    "standard_maxFeePerGas": "0x100878",
    "standard_maxPriorityFeePerGas": "0x100590",
    "slow_maxFeePerGas": "0xf4505",
    "slow_maxPriorityFeePerGas": "0xf4240",
    "callGasLimit": "0x1cbb8",
    "maxFeePerGas": "0x1b122",
    "maxPriorityFeePerGas": "0x1adb0",
    "paymasterVerificationGasLimit": "0x73c6",
    "preVerificationGas": "0xbeb0",
    "verificationGasLimit": "0x12170",
    "paymasterPostOpGasLimit": "0x0",
}

print("Gas Values Conversion")
print("-" * 50)

for key in gas_values.keys():
    wei_value = hex_to_wei(gas_values[key])
    gwei_value = wei_to_gwei(wei_value)

    print(f"\n{key}:")
    print(f"  Hex:  {gas_values[key]}")
    print(f"  Wei:  {wei_value:,} Wei")
    print(f"  Gwei: {gwei_value:.4f} Gwei\n")
