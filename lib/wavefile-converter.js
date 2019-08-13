/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview The WaveFileConverter class.
 * @see https://github.com/rochars/wavefile
 */

/** @module wavefile */

import bitDepthLib from 'bitdepth';
import * as imaadpcm from 'imaadpcm';
import * as alawmulaw from 'alawmulaw';
import {unpackArray, unpackArrayTo} from 'byte-data';
import WaveFileCreator from './wavefile-creator';
import truncateSamples from './truncate-samples';

/**
 * A class to manipulate wav files.
 * @extends WaveFileCreator
 */
export default class WaveFileConverter extends WaveFileCreator {

  /**
   * Force a file as RIFF.
   */
  toRIFF() {
    this.fromScratch(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      this.bitDepth,
      unpackArray(this.data.samples, this.dataType));
  }

  /**
   * Force a file as RIFX.
   */
  toRIFX() {
    this.fromScratch(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      this.bitDepth,
      unpackArray(this.data.samples, this.dataType),
      {container: 'RIFX'});
  }

  /**
   * Encode a 16-bit wave file as 4-bit IMA ADPCM.
   * @throws {Error} If sample rate is not 8000.
   * @throws {Error} If number of channels is not 1.
   */
  toIMAADPCM() {
    if (this.fmt.sampleRate !== 8000) {
      throw new Error(
        'Only 8000 Hz files can be compressed as IMA-ADPCM.');
    } else if (this.fmt.numChannels !== 1) {
      throw new Error(
        'Only mono files can be compressed as IMA-ADPCM.');
    } else {
      this.assure16Bit_();
      /** @type {!Int16Array} */
      let output = new Int16Array(this.data.samples.length / 2);
      unpackArrayTo(this.data.samples, this.dataType, output);
      this.fromScratch(
        this.fmt.numChannels,
        this.fmt.sampleRate,
        '4',
        imaadpcm.encode(output),
        {container: this.correctContainer_()});
    }
  }

  /**
   * Decode a 4-bit IMA ADPCM wave file as a 16-bit wave file.
   * @param {string} bitDepthCode The new bit depth of the samples.
   *    One of '8' ... '32' (integers), '32f' or '64' (floats).
   *    Optional. Default is 16.
   */
  fromIMAADPCM(bitDepthCode='16') {
    this.fromScratch(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '16',
      imaadpcm.decode(this.data.samples, this.fmt.blockAlign),
      {container: this.correctContainer_()});
    if (bitDepthCode != '16') {
      this.toBitDepth(bitDepthCode);
    }
  }

  /**
   * Encode a 16-bit wave file as 8-bit A-Law.
   */
  toALaw() {
    this.assure16Bit_();
    /** @type {!Int16Array} */
    let output = new Int16Array(this.data.samples.length / 2);
    unpackArrayTo(this.data.samples, this.dataType, output);
    this.fromScratch(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '8a',
      alawmulaw.alaw.encode(output),
      {container: this.correctContainer_()});
  }

  /**
   * Decode a 8-bit A-Law wave file into a 16-bit wave file.
   * @param {string} bitDepthCode The new bit depth of the samples.
   *    One of '8' ... '32' (integers), '32f' or '64' (floats).
   *    Optional. Default is 16.
   */
  fromALaw(bitDepthCode='16') {
    this.fromScratch(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '16',
      alawmulaw.alaw.decode(this.data.samples),
      {container: this.correctContainer_()});
    if (bitDepthCode != '16') {
      this.toBitDepth(bitDepthCode);
    }
  }

  /**
   * Encode 16-bit wave file as 8-bit mu-Law.
   */
  toMuLaw() {
    this.assure16Bit_();
    /** @type {!Int16Array} */
    let output = new Int16Array(this.data.samples.length / 2);
    unpackArrayTo(this.data.samples, this.dataType, output);
    this.fromScratch(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '8m',
      alawmulaw.mulaw.encode(output),
      {container: this.correctContainer_()});
  }

  /**
   * Decode a 8-bit mu-Law wave file into a 16-bit wave file.
   * @param {string} bitDepthCode The new bit depth of the samples.
   *    One of '8' ... '32' (integers), '32f' or '64' (floats).
   *    Optional. Default is 16.
   */
  fromMuLaw(bitDepthCode='16') {
    this.fromScratch(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '16',
      alawmulaw.mulaw.decode(this.data.samples),
      {container: this.correctContainer_()});
    if (bitDepthCode != '16') {
      this.toBitDepth(bitDepthCode);
    }
  }

  /**
   * Change the bit depth of the samples.
   * @param {string} newBitDepth The new bit depth of the samples.
   *    One of '8' ... '32' (integers), '32f' or '64' (floats)
   * @param {boolean} changeResolution A boolean indicating if the
   *    resolution of samples should be actually changed or not.
   * @throws {Error} If the bit depth is not valid.
   */
  toBitDepth(newBitDepth, changeResolution=true) {
    /** @type {string} */
    let toBitDepth = newBitDepth;
    /** @type {string} */
    let thisBitDepth = this.bitDepth;
    if (!changeResolution) {
      if (newBitDepth != '32f') {
        toBitDepth = this.dataType.bits.toString();
      }
      thisBitDepth = this.dataType.bits;
    }
    this.assureUncompressed_();
    /** @type {number} */
    let sampleCount = this.data.samples.length / (this.dataType.bits / 8);
    /** @type {!Float64Array} */
    let typedSamplesInput = new Float64Array(sampleCount);
    /** @type {!Float64Array} */
    let typedSamplesOutput = new Float64Array(sampleCount);
    unpackArrayTo(this.data.samples, this.dataType, typedSamplesInput);
    if (thisBitDepth == "32f" || thisBitDepth == "64") {
      truncateSamples(typedSamplesInput);
    }
    bitDepthLib(
      typedSamplesInput, thisBitDepth, toBitDepth, typedSamplesOutput);
    this.fromScratch(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      newBitDepth,
      typedSamplesOutput,
      {container: this.correctContainer_()});
  }

  /**
   * Make the file 16-bit if it is not.
   * @private
   */
  assure16Bit_() {
    this.assureUncompressed_();
    if (this.bitDepth != '16') {
      this.toBitDepth('16');
    }
  }

  /**
   * Uncompress the samples in case of a compressed file.
   * @private
   */
  assureUncompressed_() {
    if (this.bitDepth == '8a') {
      this.fromALaw();
    } else if (this.bitDepth == '8m') {
      this.fromMuLaw();
    } else if (this.bitDepth == '4') {
      this.fromIMAADPCM();
    }
  }

  /**
   * Return 'RIFF' if the container is 'RF64', the current container name
   * otherwise. Used to enforce 'RIFF' when RF64 is not allowed.
   * @return {string}
   * @private
   */
  correctContainer_() {
    return this.container == 'RF64' ? 'RIFF' : this.container;
  }
}