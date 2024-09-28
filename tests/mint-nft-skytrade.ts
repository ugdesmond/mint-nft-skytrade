import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  CreateCompressedNftOutput,
  Metaplex,
  keypairIdentity,
} from '@metaplex-foundation/js';
import {
  MPL_BUBBLEGUM_PROGRAM_ID,
  findTreeConfigPda,
} from '@metaplex-foundation/mpl-bubblegum';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { PublicKey as UmiPK } from '@metaplex-foundation/umi';

import {
  ConcurrentMerkleTreeAccount,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  ValidDepthSizePair,
  createAllocTreeIx,
} from '@solana/spl-account-compression';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { assert } from 'chai';
import { MintNftSkytrade } from '../target/types/mint_nft_skytrade';

describe('mint-nft-skytrade', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.MintNftSkytrade as Program<MintNftSkytrade>;

  // const connection = program.provider.connection
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  const metaplex = Metaplex.make(connection).use(keypairIdentity(wallet.payer));

  // keypair for tree
  const merkleTree = Keypair.generate();

  // tree authority
  // const [treeConfig] = PublicKey.findProgramAddressSync(
  //   [program.programId.toBuffer()],
  //   program.programId
  // );
  const umi = createUmi(provider.connection.rpcEndpoint);

  const treeConfig = findTreeConfigPda(umi, {
    merkleTree: merkleTree.publicKey.toBase58() as UmiPK,
  })[0];

  // pda "tree creator", allows our program to update the tree
  const [treeOwner] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode('tree_owner'),
      merkleTree.publicKey.toBuffer(),
    ],
    program.programId
  );

  const whitelist_tokens_pubkey = PublicKey.findProgramAddressSync(
    [Buffer.from('token_whitelist')],
    program.programId
  )[0];
  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 14,
    maxBufferSize: 64,
  };
  const canopyDepth = maxDepthSizePair.maxDepth - 5;

  const metadata = {
    uri: 'https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ',
    name: 'SKY-TRADE',
    symbol: 'SKY-T',
  };

  let collectionNft: CreateCompressedNftOutput;

  before(async () => {
    // Create collection nft
    //Initialize collections
    collectionNft = await metaplex.nfts().create({
      uri: metadata.uri,
      name: metadata.name,
      symbol: metadata.symbol,
      sellerFeeBasisPoints: 0,
      isCollection: true,
    });

    // transfer collection nft metadata update authority to pda
    await metaplex.nfts().update({
      nftOrSft: collectionNft.nft,
      updateAuthority: wallet.payer,
      newUpdateAuthority: treeOwner,
    });

    // instruction to create new account with required space for tree
    const allocTreeIx = await createAllocTreeIx(
      connection,
      merkleTree.publicKey,
      wallet.publicKey,
      maxDepthSizePair,
      canopyDepth
    );

    const tx = new Transaction().add(allocTreeIx);

    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [wallet.payer, merkleTree],
      {
        commitment: 'confirmed',
      }
    );
    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
    console.log('Tree Address:', merkleTree.publicKey.toBase58());
  });
  // it.skip('should init', async () => {
  //   const tx = await program.methods
  //     .init()
  //     .accounts({
  //       signer: wallet.payer.publicKey,
  //       whitelist: whitelist_tokens_pubkey,
  //     })
  //     .rpc();
  //   console.log({ tx });

  //   const whitelist_account = await program.account.tokenWhitelist.fetch(
  //     whitelist_tokens_pubkey
  //   );
  //   assert(
  //     whitelist_account.tokens.length === 0,
  //     'whitelist already contains token'
  //   );
  //   console.log('=====init tree  successful=====', tx);
  // });

  it('Create Tree', async () => {
    // create tree via CPI
    try {
      const txSignature = await program.methods
        .createTree(maxDepthSizePair.maxDepth, maxDepthSizePair.maxBufferSize)
        .accounts({
          signer: wallet.payer.publicKey,
          treeConfig,
          merkleTree: merkleTree.publicKey,
          treeOwner,
          logWrapper: SPL_NOOP_PROGRAM_ID,
          mplBubblegumProgram: MPL_BUBBLEGUM_PROGRAM_ID,
          compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        })
        .rpc({ commitment: 'confirmed' });
      console.log(
        `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
      );
      // fetch tree account
      const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
        connection,
        merkleTree.publicKey
      );
      console.log('=====tree account====', treeAccount);
      console.log('MaxBufferSize', treeAccount.getMaxBufferSize());
      console.log('MaxDepth', treeAccount.getMaxDepth());
      console.log('Tree Authority', treeAccount.getAuthority().toString());
      assert.strictEqual(
        treeAccount.getMaxBufferSize(),
        maxDepthSizePair.maxBufferSize
      );
      assert.strictEqual(treeAccount.getMaxDepth(), maxDepthSizePair.maxDepth);
      // assert.isTrue(treeAccount.getAuthority().equals(treeConfig));
    } catch (error) {
      console.log('=====error tree===', error);
      throw error;
    }
  });

  // it('Mint  NFT with Metaplex Bubblegum standard', async () => {
  //   try {
  //     const txSignature = await program.methods
  //       .mintNft()
  //       .accounts({
  //         pda: pda,
  //         merkleTree: merkleTree.publicKey,
  //         treeAuthority: treeAuthority,
  //         logWrapper: SPL_NOOP_PROGRAM_ID,
  //         bubblegumSigner: bubblegumSigner,
  //         bubblegumProgram: BUBBLEGUM_PROGRAM_ID,
  //         compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  //         tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //         collectionMint: collectionNft.mintAddress,
  //         collectionMetadata: collectionNft.metadataAddress,
  //         editionAccount: collectionNft.masterEditionAddress,
  //       })
  //       .rpc({ commitment: 'confirmed' });
  //     console.log(
  //       `>>>>>>>>>>>>>>>>.https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
  //     );
  //   } catch (error) {
  //     console.log('=====error occurred===', error);
  //   }
  // });
});
