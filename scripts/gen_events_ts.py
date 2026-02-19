import os
import json

# Create a file of events from all jsons containing ABIs in a Dir
# NOTE: Transfer ERC721 / ERC20 WILL conflict with each other due to indexing / data == 0x...


def extract_events_from_abi(abi):
    return [
        item
        for item in abi
        if item.get("type") == "event" or item.get("type") == "error"
    ]


def read_abi_from_artifact(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        try:
            artifact = json.load(file)
            return artifact.get("abi", [])
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from file {file_path}: {e}")
            return []


def main():
    directory = "src/constants/abi"
    all_events = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".json"):
                # and not file.endswith('ERC20.json'):
                file_path = os.path.join(root, file)
                abi = read_abi_from_artifact(file_path)
                events = extract_events_from_abi(abi)
                for event in events:
                    if event["name"] in ["Transfer", "null"]:
                        continue
                    if event not in all_events:
                        all_events.append(event)

    # Save to a new TypeScript file
    with open(
        "src/constants/abi/allEventsAndErrors.ts", "w", encoding="utf-8"
    ) as ts_file:
        ts_file.write("export const allEventsAndErrors = ")
        json.dump(all_events, ts_file, indent=2)
        ts_file.write(";")


if __name__ == "__main__":
    main()
